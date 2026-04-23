import { db } from './db.service';
import { MinistryService } from './ministry.service';
import type { PointLedger, Student } from '../types';
import type { AskAIRequest, AskAIResponse } from './ask-ai.types';

const todayIso = () => new Date().toISOString().split('T')[0];

export const normalizeText = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const getStudentTotalPoints = (ledger: PointLedger[], studentId: string) =>
  ledger.filter((entry) => entry.studentId === studentId && !entry.voided).reduce((sum, entry) => sum + entry.points, 0);

export const normalizeAskAIResponse = (input: Partial<AskAIResponse>): AskAIResponse => ({
  mode: input.mode ?? 'error',
  reply: input.reply ?? 'Something went wrong.',
  citations: input.citations ?? [],
  pendingAction: input.pendingAction ?? null,
});

export const resolveStudentMatches = (students: Student[], candidate: string): Student[] => {
  const normalizedCandidate = normalizeText(candidate);
  if (!normalizedCandidate) return [];

  const exactMatches = students.filter((student) => {
    const normalizedName = normalizeText(student.fullName);
    const normalizedKey = normalizeText(student.accessKey);
    return normalizedName === normalizedCandidate || normalizedKey === normalizedCandidate;
  });
  if (exactMatches.length > 0) return exactMatches;

  const startsWithMatches = students.filter((student) =>
    normalizeText(student.fullName).startsWith(normalizedCandidate)
  );
  if (startsWithMatches.length > 0) return startsWithMatches;

  return students.filter((student) => normalizeText(student.fullName).includes(normalizedCandidate));
};

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

  const matches = resolveStudentMatches(students, studentQuery);
  if (matches.length === 0) {
    return normalizeAskAIResponse({
      mode: 'error',
      reply: 'I could not match that student name. Try the full name or access key.',
      citations: ['students'],
    });
  }

  if (matches.length > 1) {
    const options = matches.slice(0, 5).map((student) => student.fullName).join(', ');
    return normalizeAskAIResponse({
      mode: 'answer',
      reply: `I found multiple students matching that name. Please be more specific and use the full name or access key. Matches: ${options}${matches.length > 5 ? '...' : ''}`,
      citations: ['students'],
    });
  }

  const student = matches[0];
  const total = getStudentTotalPoints(ledger, student.id);
  return normalizeAskAIResponse({
    mode: 'answer',
    reply: `${student.fullName} has ${total} total points.`,
    citations: ['points', 'students'],
  });
};

export const askDeterministic = async (
  payload: AskAIRequest,
  students: Student[]
): Promise<AskAIResponse | null> => {
  const prompt = payload.prompt.trim();
  const normalizedPrompt = normalizeText(prompt);
  const needsPointsLedger =
    normalizedPrompt.includes('points for') ||
    normalizedPrompt.includes('how many points does') ||
    normalizedPrompt.includes('what is the points of');
  const ledger = needsPointsLedger ? await db.getPointsLedger() : [];

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

  if (needsPointsLedger) {
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

  return null;
};

export const askWithLocalFallback = async (payload: AskAIRequest, students: Student[]): Promise<AskAIResponse> => {
  const deterministic = await askDeterministic(payload, students);
  return deterministic ?? answerHelp();
};
