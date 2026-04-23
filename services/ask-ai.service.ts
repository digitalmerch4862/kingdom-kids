import { db } from './db.service';
import { MinistryService } from './ministry.service';
import type { PointLedger, Student } from '../types';
import type { AskAIExecuteRequest, AskAIRequest, AskAIResponse } from './ask-ai.types';
import { canConfirmAskAIWrites } from '../utils/permissions';

const ASK_AI_API_URL = '/api/ask-ai';
const todayIso = () => new Date().toISOString().split('T')[0];

const normalizeText = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const buildStudentMatcher = (students: Student[], candidate: string): Student | null => {
  const normalizedCandidate = normalizeText(candidate);
  if (!normalizedCandidate) return null;

  const exact = students.find((student) => {
    const normalizedName = normalizeText(student.fullName);
    const normalizedKey = normalizeText(student.accessKey);
    return normalizedName === normalizedCandidate || normalizedKey === normalizedCandidate;
  });
  if (exact) return exact;

  const partial = students.find((student) => normalizeText(student.fullName).includes(normalizedCandidate));
  return partial || null;
};

const getStudentTotalPoints = (ledger: PointLedger[], studentId: string) =>
  ledger.filter((entry) => entry.studentId === studentId && !entry.voided).reduce((sum, entry) => sum + entry.points, 0);

export const normalizeAskAIResponse = (input: Partial<AskAIResponse>): AskAIResponse => ({
  mode: input.mode ?? 'error',
  reply: input.reply ?? 'Something went wrong.',
  citations: input.citations ?? [],
  pendingAction: input.pendingAction ?? null,
});

const answerHelp = () =>
  normalizeAskAIResponse({
    mode: 'answer',
    reply:
      'You can ask about absent students, follow-up, leaderboard, roster counts, student points, or draft point actions like "Add 5 points to Joshua Cruz for Memory Verse". Keep each prompt to one clear request for best results.',
    citations: ['students', 'attendance', 'points'],
  });

const answerAbsentToday = async (students: Student[]) => {
  const attendance = await db.getAttendance();
  const today = todayIso();
  const presentIds = new Set(
    attendance
      .filter((session) => session.sessionDate === today)
      .map((session) => session.studentId)
  );

  const absentStudents = students.filter(
    (student) => student.studentStatus === 'active' && !presentIds.has(student.id)
  );

  const preview = absentStudents.slice(0, 8).map((student) => student.fullName).join(', ');
  return normalizeAskAIResponse({
    mode: 'answer',
    reply: absentStudents.length
      ? `${absentStudents.length} active students are absent today. ${preview}${absentStudents.length > 8 ? '...' : ''}`
      : 'No active students are absent today.',
    citations: ['attendance', 'students'],
  });
};

const answerFollowUp = async (students: Student[]) => {
  const followUps = students
    .filter((student) => student.studentStatus === 'active' && student.consecutiveAbsences > 0)
    .sort((a, b) => b.consecutiveAbsences - a.consecutiveAbsences);

  return normalizeAskAIResponse({
    mode: 'answer',
    reply: followUps.length
      ? `Follow-up list: ${followUps
          .slice(0, 10)
          .map((student) => `${student.fullName} (${student.consecutiveAbsences})`)
          .join(', ')}`
      : 'No students currently need follow-up.',
    citations: ['students'],
  });
};

const answerLeaderboard = async () => {
  const top = (await MinistryService.getLeaderboard()).slice(0, 5);
  return normalizeAskAIResponse({
    mode: 'answer',
    reply: top.length
      ? `Top students right now: ${top
          .map((student, index) => `#${index + 1} ${student.fullName} (${student.totalPoints})`)
          .join(', ')}`
      : 'No leaderboard data is available yet.',
    citations: ['points', 'students'],
  });
};

const answerStudentPoints = async (prompt: string, students: Student[], ledger: PointLedger[]) => {
  const studentQuery = prompt
    .replace(/how many points does/i, '')
    .replace(/what(?:'s| is) the points? of/i, '')
    .replace(/points? for/i, '')
    .replace(/have\??/i, '')
    .trim();

  const student = buildStudentMatcher(students, studentQuery);
  if (!student) {
    return normalizeAskAIResponse({
      mode: 'error',
      reply: 'I could not match that student name. Try the full name or access key.',
      citations: ['students'],
    });
  }

  const total = getStudentTotalPoints(ledger, student.id);
  return normalizeAskAIResponse({
    mode: 'answer',
    reply: `${student.fullName} has ${total} total points.`,
    citations: ['points', 'students'],
  });
};

const askWithLocalFallback = async (payload: AskAIRequest, students: Student[]): Promise<AskAIResponse> => {
  const prompt = payload.prompt.trim();
  const normalizedPrompt = normalizeText(prompt);
  const ledger = normalizedPrompt.includes('points') ? await db.getPointsLedger() : [];

  if (normalizedPrompt.includes('absent today') || normalizedPrompt.includes('who is absent')) {
    return answerAbsentToday(students);
  }

  if (normalizedPrompt.includes('follow up') || normalizedPrompt.includes('follow-up')) {
    return answerFollowUp(students);
  }

  if (normalizedPrompt.includes('leaderboard') || normalizedPrompt.includes('top students')) {
    return answerLeaderboard();
  }

  if (normalizedPrompt.includes('how many students') || normalizedPrompt.includes('total students')) {
    const activeCount = students.filter((student) => student.studentStatus === 'active').length;
    return normalizeAskAIResponse({
      mode: 'answer',
      reply: `There are ${activeCount} active students in the ministry roster.`,
      citations: ['students'],
    });
  }

  if (
    normalizedPrompt.includes('points for') ||
    normalizedPrompt.includes('how many points does') ||
    normalizedPrompt.includes('what is the points of')
  ) {
    return answerStudentPoints(prompt, students, ledger.length ? ledger : await db.getPointsLedger());
  }

  if (
    normalizedPrompt.includes('how to use') ||
    normalizedPrompt.includes('help me use') ||
    normalizedPrompt === 'help' ||
    normalizedPrompt.includes('what can you do')
  ) {
    return answerHelp();
  }

  return answerHelp();
};

const askServer = async (payload: AskAIRequest): Promise<AskAIResponse> => {
  const response = await fetch(ASK_AI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorMessage = 'Ask AI is unavailable right now.';
    try {
      const errorJson = await response.json();
      errorMessage = errorJson.error || errorMessage;
    } catch {
      errorMessage = await response.text() || errorMessage;
    }
    throw new Error(errorMessage);
  }

  return normalizeAskAIResponse(await response.json());
};

export class AskAIService {
  static async ask(payload: AskAIRequest): Promise<AskAIResponse> {
    const prompt = payload.prompt.trim();
    if (!prompt) {
      return normalizeAskAIResponse({
        mode: 'error',
        reply: 'Ask a question first.',
      });
    }

    const students = await db.getStudents();

    try {
      return await askServer(payload);
    } catch (error) {
      console.error('Ask AI server error:', error);
      return await askWithLocalFallback(payload, students);
    }
  }

  static async executeAddPoints(input: AskAIExecuteRequest) {
    if (!canConfirmAskAIWrites({
      role: input.actor.role as any,
      username: input.actor.username,
      isReadOnly: input.actor.isReadOnly,
    })) {
      throw new Error('Only RAD and FACILITATOR can confirm Ask AI write actions.');
    }

    return MinistryService.addPoints(
      input.studentId,
      input.category,
      input.points,
      input.actor.username,
      input.notes,
      'ASK_AI'
    );
  }
}
