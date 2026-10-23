/** A chat model as shown to the user: the connection's name and the model key. */
export type ModelLabel = { provider: string; model: string };

/** Which model produced an answer, and when it was asked and finished. */
export type AnswerModelInfo = {
  model?: ModelLabel;
  /** Set when the chosen model failed and its fallback wrote the answer. */
  fallbackFrom?: ModelLabel;
  startedAt: string;
  completedAt?: string;
};
