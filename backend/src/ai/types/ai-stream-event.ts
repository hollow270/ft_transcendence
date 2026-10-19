export interface AiStreamEvent {
  data: string;
}

export type AiStreamPayload =
  | { event: 'start'; messageId?: string }
  | { event: 'delta'; text: string }
  | { event: 'complete'; messageId?: string; status: 'COMPLETE' }
  | { event: 'error'; code?: string; message: string };

export type AiChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string };

export type AiProviderStreamChunk =
  | { type: 'delta'; text: string }
  | {
      type: 'usage';
      inputTokens: number;
      outputTokens: number;
    };
