import { ModelWithProvider } from './types';

export type ChatOrigin = 'user' | 'digest' | 'discover';

/**
 * The model and fallback to send for a message. Chats opened from Discover use
 * the Discover model when one is set (including for follow-ups in the same
 * thread); everything else uses the selected chat model. The fallback is
 * dropped when it is the model already being used.
 */
export function pickChatModel(input: {
  origin: ChatOrigin;
  chatModel: ModelWithProvider;
  discoverModel: ModelWithProvider | null;
  fallbackModel: ModelWithProvider | null;
}): { chatModel: ModelWithProvider; fallbackChatModel: ModelWithProvider | null } {
  const chatModel =
    input.origin === 'discover' && input.discoverModel
      ? input.discoverModel
      : input.chatModel;
  const fallback = input.fallbackModel;
  const sameAsChat =
    !!fallback &&
    fallback.providerId === chatModel.providerId &&
    fallback.key === chatModel.key;
  return { chatModel, fallbackChatModel: fallback && !sameAsChat ? fallback : null };
}
