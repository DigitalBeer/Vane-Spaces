'use client';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import ModelDropdownPair from './ModelDropdownPair';

export type EditableDigest = {
  id: string;
  name: string;
  queries: string[];
  instructions: string | null;
  excludedDomains: string[];
  frequency: 'daily' | 'weekly';
  timeOfDay: string;
  dayOfWeek: number | null;
  optimizationMode: 'speed' | 'balanced' | 'quality';
  chatModelProviderId: string;
  chatModelKey: string;
  embeddingModelProviderId: string;
  embeddingModelKey: string;
};

type CreateDigestModalProps = {
  onClose: () => void;
  onSaved: (digest: unknown) => void;
  editing?: EditableDigest | null;
};

const OPTIMIZATION_MODE_DESCRIPTIONS: Record<'speed' | 'balanced' | 'quality', string> = {
  speed: 'Prioritize speed and get the quickest possible answer.',
  balanced: 'Find the right balance between speed and accuracy.',
  quality: 'Get the most thorough and accurate answer (slower, more searches).',
};

const CreateDigestModal: React.FC<CreateDigestModalProps> = ({ onClose, onSaved, editing }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const [name, setName] = useState(editing?.name ?? '');
  const [queries, setQueries] = useState<string[]>(editing?.queries.length ? editing.queries : ['']);
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>(editing?.frequency ?? 'daily');
  const [dayOfWeek, setDayOfWeek] = useState<number>(editing?.dayOfWeek ?? 1);
  const [timeOfDay, setTimeOfDay] = useState(editing?.timeOfDay ?? '09:00');
  const [optimizationMode, setOptimizationMode] = useState<'speed' | 'balanced' | 'quality'>(editing?.optimizationMode ?? 'balanced');
  const [chatProviderId, setChatProviderId] = useState(editing?.chatModelProviderId ?? '');
  const [chatModelKey, setChatModelKey] = useState(editing?.chatModelKey ?? '');
  const [embedProviderId, setEmbedProviderId] = useState(editing?.embeddingModelProviderId ?? '');
  const [embedModelKey, setEmbedModelKey] = useState(editing?.embeddingModelKey ?? '');
  const [instructions, setInstructions] = useState(editing?.instructions ?? '');
  const [excluded, setExcluded] = useState(editing?.excludedDomains.join('\n') ?? '');
  const [loading, setLoading] = useState(false);

  const setQuery = (i: number, v: string): void => setQueries((qs: string[]) => qs.map((q: string, idx: number) => (idx === i ? v : q)));
  const addQuery = (): void => setQueries((qs: string[]) => [...qs, '']);
  const removeQuery = (i: number): void => setQueries((qs: string[]) => (qs.length <= 1 ? qs : qs.filter((_: string, idx: number) => idx !== i)));

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const cleanQueries: string[] = queries.map((q: string) => q.trim()).filter((q: string) => q.length > 0);
    if (!name.trim()) { toast.error('Name is required'); return; }
    if (cleanQueries.length === 0) { toast.error('Add at least one query'); return; }
    if (!chatProviderId || !chatModelKey || !embedProviderId || !embedModelKey) { toast.error('Pick chat and embedding models'); return; }
    const excludedDomains: string[] = excluded.split(/[\n,]/).map((d: string) => d.trim()).filter((d: string) => d.length > 0);
    setLoading(true);
    try {
      const body = {
        name: name.trim(),
        queries: cleanQueries,
        frequency,
        timeOfDay,
        dayOfWeek: frequency === 'weekly' ? dayOfWeek : null,
        optimizationMode,
        chatModelProviderId: chatProviderId,
        chatModelKey,
        embeddingModelProviderId: embedProviderId,
        embeddingModelKey: embedModelKey,
        instructions: instructions.trim() || null,
        excludedDomains,
      };
      const res = await fetch(editing ? `/api/digests/${editing.id}` : '/api/digests', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || `Failed to ${editing ? 'save' : 'create'} digest`); return; }
      onSaved(data.digest);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-light-primary dark:bg-dark-primary rounded-2xl border border-light-200 dark:border-dark-200 p-6 w-full max-w-lg mx-4 shadow-xl max-h-[85vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">{editing ? 'Edit Digest Topic' : 'New Digest Topic'}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#24A0ED]"
            placeholder="Enter topic name"
          />
          <div className="flex flex-col gap-1">
            <label className="block text-sm text-black/60 dark:text-white/60 mb-1">Queries</label>
            {queries.map((q, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQuery(i, e.target.value)}
                  className="w-full rounded-lg bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#24A0ED]"
                  placeholder="e.g. Today's major AI model releases"
                />
                <button
                  type="button"
                  onClick={() => removeQuery(i)}
                  className="text-sm text-black/60 dark:text-white/60"
                >
                  ✕
                </button>
              </div>
            ))}
            <button type="button" onClick={addQuery} className="text-sm text-black/60 dark:text-white/60">
              + Add query
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFrequency('daily')}
              className={`text-sm py-1 px-4 border rounded ${
                frequency === 'daily' ? 'bg-[#24A0ED] text-white' : 'border-light-200 dark:border-dark-200'
              }`}
            >
              Daily
            </button>
            <button
              type="button"
              onClick={() => setFrequency('weekly')}
              className={`text-sm py-1 px-4 border rounded ${
                frequency === 'weekly' ? 'bg-[#24A0ED] text-white' : 'border-light-200 dark:border-dark-200'
              }`}
            >
              Weekly
            </button>
          </div>
          {frequency === 'weekly' && (
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
              className="w-full rounded-lg bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#24A0ED]"
            >
              {Array.from({ length: 7 }, (_, i) => (
                <option key={i} value={i}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]}
                </option>
              ))}
            </select>
          )}
          <div className="flex items-center">
            <input
              type="time"
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(e.target.value)}
              className="w-full rounded-lg bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#24A0ED]"
            />
            <p className="text-xs text-black/40 dark:text-white/40 ml-3 whitespace-nowrap">Times are in the server's timezone.</p>
          </div>
          <div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOptimizationMode('speed')}
                title={OPTIMIZATION_MODE_DESCRIPTIONS.speed}
                className={`text-sm py-1 px-4 border rounded ${
                  optimizationMode === 'speed' ? 'bg-[#24A0ED] text-white' : 'border-light-200 dark:border-dark-200'
                }`}
              >
                Speed
              </button>
              <button
                type="button"
                onClick={() => setOptimizationMode('balanced')}
                title={OPTIMIZATION_MODE_DESCRIPTIONS.balanced}
                className={`text-sm py-1 px-4 border rounded ${
                  optimizationMode === 'balanced' ? 'bg-[#24A0ED] text-white' : 'border-light-200 dark:border-dark-200'
                }`}
              >
                Balanced
              </button>
              <button
                type="button"
                onClick={() => setOptimizationMode('quality')}
                title={OPTIMIZATION_MODE_DESCRIPTIONS.quality}
                className={`text-sm py-1 px-4 border rounded ${
                  optimizationMode === 'quality' ? 'bg-[#24A0ED] text-white' : 'border-light-200 dark:border-dark-200'
                }`}
              >
                Quality
              </button>
            </div>
            <p className="text-xs text-black/40 dark:text-white/40 mt-1">{OPTIMIZATION_MODE_DESCRIPTIONS[optimizationMode]}</p>
          </div>
          <div>
            <label className="block text-sm text-black/60 dark:text-white/60 mb-1">Chat model</label>
            <ModelDropdownPair
              kind="chat"
              providerId={chatProviderId}
              modelKey={chatModelKey}
              onChange={(p: string, m: string) => {
                setChatProviderId(p);
                setChatModelKey(m);
              }}
            />
          </div>
          <div>
            <label className="block text-sm text-black/60 dark:text-white/60 mb-1">Embedding model</label>
            <ModelDropdownPair
              kind="embedding"
              providerId={embedProviderId}
              modelKey={embedModelKey}
              onChange={(p: string, m: string) => {
                setEmbedProviderId(p);
                setEmbedModelKey(m);
              }}
            />
          </div>
          <details className="flex flex-col gap-3">
            <summary className="text-sm cursor-pointer text-black/60 dark:text-white/60">Advanced</summary>
            <div>
              <label className="block text-sm text-black/60 dark:text-white/60 mb-1" title="Free-text steering for the model — tone, focus, what to skip. Not a hard filter, just guidance.">
                Instructions
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full rounded-lg bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#24A0ED]"
                placeholder="e.g. Focus on model releases and benchmarks, skip rumor pieces"
              />
              <p className="text-xs text-black/40 dark:text-white/40 mt-1">Steers how answers are written for this topic. Not guaranteed to be followed exactly.</p>
            </div>
            <div>
              <label className="block text-sm text-black/60 dark:text-white/60 mb-1" title="Domains to exclude from search results for this topic — a hard filter.">
                Excluded domains
              </label>
              <textarea
                value={excluded}
                onChange={(e) => setExcluded(e.target.value)}
                className="w-full rounded-lg bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#24A0ED]"
                placeholder="one domain per line, e.g. example.com"
              />
              <p className="text-xs text-black/40 dark:text-white/40 mt-1">Sources here are never used for this topic. Also populated automatically when you downvote a source in the feed.</p>
            </div>
          </details>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm py-1 px-4 border border-light-200 dark:border-dark-200 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="text-sm py-1 px-4 bg-[#24A0ED] text-white rounded"
            >
              {editing ? (loading ? 'Saving…' : 'Save') : (loading ? 'Creating…' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default CreateDigestModal;
