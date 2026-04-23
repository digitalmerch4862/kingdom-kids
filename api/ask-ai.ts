import { db } from '../services/db.service';
import type { AskAIRequest, AskAIResponse } from '../services/ask-ai.types';
import type { Student } from '../types';
import { canConfirmAskAIWrites } from '../utils/permissions';
import { askDeterministic, askWithLocalFallback, normalizeAskAIResponse, normalizeText, resolveStudentMatches } from '../services/ask-ai.logic';

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
  const today = new Date().toISOString().split('T')[0];
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

  const matches = resolveStudentMatches(students, payload.pendingAction.studentName);
  if (matches.length === 0) {
    return normalizeAskAIResponse({
      mode: 'error',
      reply: `${payload.reply}\n\nI could not match the student for that action. Try using the full name or access key.`,
      citations: payload.citations,
    });
  }

  if (matches.length > 1) {
    const options = matches.slice(0, 5).map((student) => student.fullName).join(', ');
    return normalizeAskAIResponse({
      mode: 'answer',
      reply: `${payload.reply}\n\nI found multiple students matching that action. Please use the full name or access key. Matches: ${options}${matches.length > 5 ? '...' : ''}`,
      citations: payload.citations,
    });
  }

  const student = matches[0];

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

const askOpenAI = async (payload: AskAIRequest, students: Student[]): Promise<AskAIResponse> => {
  const deterministic = await askDeterministic(payload, students);
  if (deterministic) {
    return deterministic;
  }

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
                today: new Date().toISOString().split('T')[0],
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
