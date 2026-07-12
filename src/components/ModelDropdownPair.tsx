'use client';

import React, { useEffect, useState } from 'react';

type ProviderModel = { key: string; name?: string };
type Provider = { id: string; name: string; chatModels: ProviderModel[]; embeddingModels: ProviderModel[] };
type ModelDropdownPairProps = {
  kind: 'chat' | 'embedding';
  providerId: string;
  modelKey: string;
  onChange: (providerId: string, modelKey: string) => void;
};

const ModelDropdownPair = ({ kind, providerId, modelKey, onChange }: ModelDropdownPairProps) => {
  const [providers, setProviders] = useState<Provider[]>([]);

  useEffect(() => {
    let active = true;
    fetch('/api/providers')
      .then((r: Response) => r.json())
      .then((data: { providers?: Provider[] }) => {
        if (active) setProviders(data.providers ?? []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const modelsFor = (p: Provider | undefined): ProviderModel[] =>
    !p ? [] : kind === 'chat' ? p.chatModels : p.embeddingModels;

  const eligibleProviders: Provider[] = providers.filter(
    (p: Provider) => modelsFor(p).length > 0,
  );

  const selectedProvider: Provider | undefined = eligibleProviders.find(
    (p: Provider) => p.id === providerId,
  );
  const models: ProviderModel[] = modelsFor(selectedProvider);

  const handleProvider = (id: string): void => {
    const p: Provider | undefined = eligibleProviders.find((pv: Provider) => pv.id === id);
    const first: string = modelsFor(p)[0]?.key ?? '';
    onChange(id, first);
  };

  const selectClass =
    'w-full rounded-lg bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#24A0ED]';

  return (
    <div className="flex gap-2">
      <select className={selectClass} value={providerId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleProvider(e.target.value)}>
        <option value="">Provider…</option>
        {eligibleProviders.map((p: Provider) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <select className={selectClass} value={modelKey} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(providerId, e.target.value)} disabled={!selectedProvider}>
        <option value="">Model…</option>
        {models.map((m: ProviderModel) => (
          <option key={m.key} value={m.key}>{m.name ?? m.key}</option>
        ))}
      </select>
    </div>
  );
};

export default ModelDropdownPair;
