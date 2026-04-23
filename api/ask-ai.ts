import { db } from '../services/db.service';
import { MinistryService } from '../services/ministry.service';
import type { AskAIRequest, AskAIResponse } from '../services/ask-ai.types';
import type { PointLedger, Student } from '../types';
import { canConfirmAskAIWrites } from '../utils/permissions';

const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

type ServerRequest = {
  method?: string;
  body?: unknown;
};

type ServerResponse = {
  status: (code: number) => ServerResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string | string[]) => void;
};

type AskAIModelPayload = {
  reply: string;
  citations: string[];
  pendingAction: {
    type: 'add_points';
    studentName: string;
    points: number;
    category: string;
    notes?: string;
  } | null;
};

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

const toStudentSummary = (students: Student[]) =>
  students.slice(0, 200).map((student) => ({
    id: student.id,
    fullName: student.fullName,
    accessKey: student.accessKey,
    ageGroup: student.ageGroup,
    consecutiveAbsences: student.consecutiveAbsences,
    studentStatus: student.studentStatus,
  }));

const toAttendanceSummary = (attendance: Awaited<ReturnType<typeof db.getAttendance>>) => {
  const today = todayIso();
  return attendance
    .filter((session) => session.sessionDate === today)
    .map((session) => ({
      studentId: session.studentId,
      sessionDate: session.sessionDate,
      status: session.status,
      checkInTime: session.checkInTime,
    }));
};

const toPointsSummary = (ledger: PointLedger[]) =>
  ledger.slice(0, 300).map((entry) => ({
    studentId: entry.studentId,
    entryDate: entry.entryDate,
    category: entry.category,
    points: entry.points,
    voided: entry.voided,
  }));

const normalizeAskAIResponse = (input: Partial<AskAIResponse>): AskAIResponse => ({
  mode: input.mode ?? 'error',
  reply: input.reply ?? 'Something went wrong.',
  citations: input.citations ?? [],
  pendingAction: input.pendingAction ?? null,
});

const finalizePendingAction = (
  payload: AskAIModelPayload,
  students: Student[],
  canWrite: boolean
): AskAIResponse => {
  if (!payload.pendingAction) {
    return normalizeAskAIResponse({
      mode: 'answer',
      reply: payload.reply,
      citations: payload.citations,
    });
  }

  const student = buildStudentMatcher(students, payload.pendingAction.studentName);
  if (!student) {
    return normalizeAskAIResponse({
      mode: 'error',
      reply: `${payload.reply}\n\nI could not match the student for that action. Try using the full name or access key.`,
      citations: payload.citations,
    });
  }

  if (!canWrite) {
    return normalizeAskAIResponse({
      mode: 'answer',
      reply: `${payload.reply}\n\nThis session is view-only, so I did not prepare a save action.`,
      citations: payload.citations,
    });
  }

  return normalizeAskAIResponse({
    mode: 'confirm',
    reply: payload.reply,
    citations: payload.citations,
    pendingAction: {
      type: 'add_points',
      studentId: student.id,
      studentName: student.fullName,
      points: payload.pendingAction.points,
      category: payload.pendingAction.category,
      notes: payload.pendingAction.notes || `Ask AI draft: ${payload.pendingAction.category}`,
    },
  });
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

const askOpenAI = async (payload: AskAIRequest, students: Student[]): Promise<AskAIResponse> => {
  const attendance = await db.getAttendance();
  const ledger = await db.getPointsLedger();
  const canWrite = canConfirmAskAIWrites({
    role: payload.actor.role as any,
    username: payload.actor.username,
    isReadOnly: payload.actor.isReadOnly,
  });

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      reasoning: { effort: 'low' },
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text:
                'You are Ask AI for Kingdom Kids. Answer only from the provided ministry data. Be concise, practical, and safe. If the request needs a points update, only prepare a pending add_points action when the data clearly supports it. Never invent students or records. If the user session is view-only, do not request a pending action. Cite only from: students, attendance, points, leaderboard.',
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify({
                actor: {
                  role: payload.actor.role,
                  username: payload.actor.username,
                  isReadOnly: payload.actor.isReadOnly || false,
                  canWrite,
                },
                today: todayIso(),
                prompt: payload.prompt,
                students: toStudentSummary(students),
                attendanceToday: toAttendanceSummary(attendance),
                pointsLedger: toPointsSummary(ledger),
              }),
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'ask_ai_response',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              reply: { type: 'string' },
              citations: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['students', 'attendance', 'points', 'leaderboard'],
                },
              },
              pendingAction: {
                anyOf: [
                  {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      type: { type: 'string', enum: ['add_points'] },
                      studentName: { type: 'string' },
                      points: { type: 'number' },
                      category: { type: 'string' },
                      notes: { type: 'string' },
                    },
                    required: ['type', 'studentName', 'points', 'category', 'notes'],
                  },
                  { type: 'null' },
                ],
              },
            },
            required: ['reply', 'citations', 'pendingAction'],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'OpenAI request failed.');
  }

  const json = await response.json();
  const rawText = json.output_text;
  if (!rawText) {
    throw new Error('OpenAI returned an empty response.');
  }

  const parsed = JSON.parse(rawText) as AskAIModelPayload;
  return finalizePendingAction(parsed, students, canWrite);
};

export default async function handler(req: ServerRequest, res: ServerResponse) {
  res.setHeader('Allow', ['POST']);

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const payload = (req.body || {}) as Partial<AskAIRequest>;
  if (!payload.prompt || !payload.actor?.role || !payload.actor?.username) {
    res.status(400).json({ error: 'Invalid Ask AI request.' });
    return;
  }

  try {
    const students = await db.getStudents();
    const response = OPENAI_API_KEY
      ? await askOpenAI(payload as AskAIRequest, students).catch(async (error) => {
          console.error('Ask AI OpenAI error:', error);
          return askWithLocalFallback(payload as AskAIRequest, students);
        })
      : await askWithLocalFallback(payload as AskAIRequest, students);

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Ask AI is unavailable right now.',
    });
  }
}
