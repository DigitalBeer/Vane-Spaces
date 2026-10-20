'use client';

const getClientConfig = (key: string, defaultVal?: any) => {
  return localStorage.getItem(key) ?? defaultVal ?? undefined;
};

export const getTheme = () => getClientConfig('theme', 'dark');

export const getAutoMediaSearch = () =>
  getClientConfig('autoMediaSearch', 'true') === 'true';

export const getSystemInstructions = () =>
  getClientConfig('systemInstructions', '');

export const getShowWeatherWidget = () =>
  getClientConfig('showWeatherWidget', 'true') === 'true';

export const getShowNewsWidget = () =>
  getClientConfig('showNewsWidget', 'true') === 'true';

export const getLightweightResearch = () =>
  getClientConfig('lightweightResearch', 'false') === 'true';

export const getShowSuggestions = () =>
  getClientConfig('showSuggestions', 'true') === 'true';

/** A model saved as `${prefix}ProviderId` / `${prefix}Key`, or null when unset. */
const getSavedModel = (prefix: string) => {
  const providerId = localStorage.getItem(`${prefix}ProviderId`);
  const key = localStorage.getItem(`${prefix}Key`);
  return providerId && key ? { providerId, key } : null;
};

/** Chat model for chats opened from Discover; null means "use the chat model". */
export const getDiscoverChatModel = () => getSavedModel('discoverChatModel');

/** Model a call falls back to when the chosen one is gone, rate-limited or unreachable. */
export const getFallbackChatModel = () => getSavedModel('fallbackChatModel');

export const getMeasurementUnit = () => {
  const value =
    getClientConfig('measureUnit') ??
    getClientConfig('measurementUnit', 'metric');

  if (typeof value !== 'string') return 'metric';

  return value.toLowerCase();
};
