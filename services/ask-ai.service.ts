import { db } from './db.service';
import { MinistryService } from './ministry.service';
import type { PointLedger, Student } from '../types';
import type { AskAIAddPointsAction, AskAIRequest, AskAIResponse } from './ask-ai.types';

const todayIso = () => new Date().toISOString().split('T')[0];

const normalizeText = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

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

const buildAddPointsAction = (prompt: string, students: Student[]): AskAIAddPointsAction | null => {
  const match = prompt.match(/add\s+(\d+)\s+points?\s+to\s+(.+?)(?:\s+for\s+(.+))?$/i);
  if (!match) return null;

  const [, pointsRaw, studentNameRaw, categoryRaw] = match;
  const student = buildStudentMatcher(students, studentNameRaw);
  if (!student) return null;

  const points = Number(pointsRaw);
  const category = (categoryRaw || 'Manual Adjustment').trim();

  return {
    type: 'add_points',
    studentId: student.id,
    studentName: student.fullName,
    points,
    category,
    notes: `Ask AI draft: ${category}`,
  };
};

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
      ? `Top students right now: ${top.map((student, index) => `#${index + 1} ${student.fullName} (${student.totalPoints})`).join(', ')}`
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

export const normalizeAskAIResponse = (input: Partial<AskAIResponse>): AskAIResponse => ({
  mode: input.mode ?? 'error',
  reply: input.reply ?? 'Something went wrong.',
  citations: input.citations ?? [],
  pendingAction: input.pendingAction ?? null,
});

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
    const addPointsAction = buildAddPointsAction(prompt, students);
    if (addPointsAction) {
      return normalizeAskAIResponse({
        mode: 'confirm',
        reply: `Add ${addPointsAction.points} points to ${addPointsAction.studentName} for ${addPointsAction.category}?`,
        citations: ['students', 'points'],
        pendingAction: addPointsAction,
      });
    }

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

    if (normalizedPrompt.includes('points for') || normalizedPrompt.includes('how many points does') || normalizedPrompt.includes('what is the points of')) {
      return answerStudentPoints(prompt, students, ledger.length ? ledger : await db.getPointsLedger());
    }

    return normalizeAskAIResponse({
      mode: 'answer',
      reply: 'I can help with attendance, follow-up, leaderboard, roster counts, student points, and draft add-points actions like "Add 5 points to Joshua for Memory Verse".',
      citations: ['students', 'attendance', 'points'],
    });
  }

  static async executeAddPoints(input: AskAIAddPointsAction & { actor: string }) {
    return MinistryService.addPoints(
      input.studentId,
      input.category,
      input.points,
      input.actor,
      input.notes
    );
  }
}
