import Select from '@/components/ui/Select';
import { ConfigModelProvider } from '@/lib/config/types';
import { useState } from 'react';

const COPY = {
  discover: {
    title: 'Discover Model',
    description:
      'Used for articles opened from Discover and follow-up questions in those threads. Leave unset to use the chat model.',
    storagePrefix: 'discoverChatModel',
  },
  fallback: {
    title: 'Fallback Model',
    description:
      'Used automatically when the chosen model is gone, rate-limited or unreachable (e.g. a free cloud model runs out, or a laptop server is asleep).',
    storagePrefix: 'fallbackChatModel',
  },
} as const;

/** A chat-model picker that can be left unset, saved in localStorage like the main pickers. */
const OptionalModelSelect = ({
  providers,
  type,
}: {
  providers: ConfigModelProvider[];
  type: keyof typeof COPY;
}) => {
  const { title, description, storagePrefix } = COPY[type];
  const [selected, setSelected] = useState<string>(() => {
    const providerId = localStorage.getItem(`${storagePrefix}ProviderId`);
    const key = localStorage.getItem(`${storagePrefix}Key`);
    return providerId && key ? `${providerId}/${key}` : '';
  });

  const handleSave = (value: string) => {
    setSelected(value);
    if (!value) {
      localStorage.removeItem(`${storagePrefix}ProviderId`);
      localStorage.removeItem(`${storagePrefix}Key`);
      return;
    }
    const providerId = value.split('/')[0];
    const key = value.split('/').slice(1).join('/');
    localStorage.setItem(`${storagePrefix}ProviderId`, providerId);
    localStorage.setItem(`${storagePrefix}Key`, key);
  };

  return (
    <section className="rounded-xl border border-light-200 bg-light-primary/80 p-4 lg:p-6 transition-colors dark:border-dark-200 dark:bg-dark-primary/80">
      <div className="space-y-3 lg:space-y-5">
        <div>
          <h4 className="text-sm lg:text-sm text-black dark:text-white">
            {title}
          </h4>
          <p className="text-[11px] lg:text-xs text-black/50 dark:text-white/50">
            {description}
          </p>
        </div>
        <Select
          value={selected}
          onChange={(event) => handleSave(event.target.value)}
          options={[
            { value: '', label: 'Not set' },
            ...providers.flatMap((provider) =>
              provider.chatModels.map((model) => ({
                value: `${provider.id}/${model.key}`,
                label: `${provider.name} - ${model.name}`,
              })),
            ),
          ]}
          className="!text-xs lg:!text-[13px]"
        />
      </div>
    </section>
  );
};

export default OptionalModelSelect;
