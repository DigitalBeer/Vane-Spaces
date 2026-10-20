type ModelRef = { providerId: string; key: string };

export const getSuggestions = async (
  chatHistory: [string, string][],
  models?: { chatModel: ModelRef; fallbackChatModel: ModelRef | null },
) => {
  const chatModel = models?.chatModel ?? {
    providerId: localStorage.getItem('chatModelProviderId'),
    key: localStorage.getItem('chatModelKey'),
  };

  const res = await fetch(`/api/suggestions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chatHistory,
      chatModel,
      fallbackChatModel: models?.fallbackChatModel ?? null,
    }),
  });

  const data = (await res.json()) as { suggestions: string[] };

  return data.suggestions;
};

export const getApproxLocation = async () => {
  const res = await fetch('https://free.freeipapi.com/api/json', {
    method: 'GET',
  });

  const data = await res.json();

  return {
    latitude: data.latitude,
    longitude: data.longitude,
    city: data.cityName,
  };
};
