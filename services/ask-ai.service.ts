import { db } from './db.service';
import { MinistryService } from './ministry.service';
import type { AskAIExecuteRequest, AskAIRequest, AskAIResponse } from './ask-ai.types';
import { canConfirmAskAIWrites } from '../utils/permissions';
import { askDeterministic, askWithLocalFallback, normalizeAskAIResponse } from './ask-ai.logic';

const ASK_AI_API_URL = '/api/ask-ai';
export { normalizeAskAIResponse } from './ask-ai.logic';

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
    const deterministic = await askDeterministic(payload, students);
    if (deterministic) {
      return deterministic;
    }

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
