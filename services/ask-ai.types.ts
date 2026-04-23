export type AskAIMode = 'answer' | 'confirm' | 'error';

export interface AskAIAddPointsAction {
  type: 'add_points';
  studentId: string;
  studentName: string;
  points: number;
  category: string;
  notes: string;
}

export interface AskAIResponse {
  mode: AskAIMode;
  reply: string;
  citations: string[];
  pendingAction: AskAIAddPointsAction | null;
}

export interface AskAIRequest {
  prompt: string;
  actor: {
    role: string;
    username: string;
    isReadOnly?: boolean;
  };
}

export interface AskAIExecuteRequest extends AskAIAddPointsAction {
  actor: {
    role: string;
    username: string;
    isReadOnly?: boolean;
  };
}
