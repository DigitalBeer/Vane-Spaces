type ProviderModels = {
  id: string;
  chatModels: { key: string }[];
  embeddingModels: { key: string }[];
};

export type DigestModelChoice = {
  chatModelProviderId: string;
  chatModelKey: string;
  embeddingModelProviderId: string;
  embeddingModelKey: string;
  fallbackChatModelProviderId: string | null;
  fallbackChatModelKey: string | null;
};

/**
 * Reads the optional fallback chat model from a request body. Both parts must
 * be present; anything else (missing, empty, or only one part) means "none".
 */
export const readFallbackChoice = (
  body: Record<string, unknown>,
): { fallbackChatModelProviderId: string | null; fallbackChatModelKey: string | null } => {
  const providerId = typeof body.fallbackChatModelProviderId === 'string' ? body.fallbackChatModelProviderId : '';
  const key = typeof body.fallbackChatModelKey === 'string' ? body.fallbackChatModelKey : '';
  return providerId && key
    ? { fallbackChatModelProviderId: providerId, fallbackChatModelKey: key }
    : { fallbackChatModelProviderId: null, fallbackChatModelKey: null };
};

/** Returns an error message if a chosen model isn't configured, else null. */
export const checkDigestModels = (
  providers: ProviderModels[],
  choice: DigestModelChoice,
): string | null => {
  const hasChat = (providerId: string, key: string): boolean =>
    !!providers.find((p) => p.id === providerId)?.chatModels.some((m) => m.key === key);
  const hasEmbedding = (providerId: string, key: string): boolean =>
    !!providers.find((p) => p.id === providerId)?.embeddingModels.some((m) => m.key === key);

  if (!hasChat(choice.chatModelProviderId, choice.chatModelKey))
    return 'Selected chat model is not configured.';
  if (!hasEmbedding(choice.embeddingModelProviderId, choice.embeddingModelKey))
    return 'Selected embedding model is not configured.';
  if (
    choice.fallbackChatModelProviderId &&
    choice.fallbackChatModelKey &&
    !hasChat(choice.fallbackChatModelProviderId, choice.fallbackChatModelKey)
  )
    return 'Selected fallback model is not configured.';
  return null;
};
