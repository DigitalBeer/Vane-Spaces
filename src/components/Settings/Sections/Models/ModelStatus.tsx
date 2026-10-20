import { ConfigModelProvider } from '@/lib/config/types';
import { AlertTriangle, PauseCircle } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

type FreeModelVerdict = {
  providerId: string;
  providerName: string;
  modelKey: string;
  status: 'withdrawn' | 'no-longer-free';
  replacement?: string;
};

type BenchedModel = {
  key: string;
  providerName: string;
  modelKey: string;
  errorClass: 'unavailable' | 'quota' | 'transient' | 'auth';
  recoversAt: number;
};

const BENCH_REASON: Record<BenchedModel['errorClass'], string> = {
  unavailable: 'model unavailable',
  quota: 'usage limit reached',
  transient: 'unreachable or overloaded',
  auth: 'API key rejected',
};

const SAVED_MODEL_PREFIXES = ['chatModel', 'discoverChatModel', 'fallbackChatModel'];

/**
 * Free OpenRouter models that are no longer free (with a one-click switch to
 * a replacement) and models paused after failing at runtime. Renders nothing
 * when everything is fine.
 */
const ModelStatus = ({
  setProviders,
}: {
  setProviders: React.Dispatch<React.SetStateAction<ConfigModelProvider[]>>;
}) => {
  const [freeModels, setFreeModels] = useState<FreeModelVerdict[]>([]);
  const [benched, setBenched] = useState<BenchedModel[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/models/status');
      if (!res.ok) return;
      const data = await res.json();
      setFreeModels(data.freeModels ?? []);
      setBenched(data.benched ?? []);
    } catch {
      // Status is advisory; a failed check just shows nothing.
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const switchModel = async (v: FreeModelVerdict) => {
    if (!v.replacement) return;
    setBusy(v.modelKey);
    try {
      const add = await fetch(`/api/providers/${v.providerId}/models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'chat', key: v.replacement, name: v.replacement }),
      });
      if (!add.ok) throw new Error('add failed');
      const remove = await fetch(`/api/providers/${v.providerId}/models`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'chat', key: v.modelKey }),
      });
      if (!remove.ok) throw new Error('remove failed');

      // Point any saved selection at the replacement.
      for (const prefix of SAVED_MODEL_PREFIXES) {
        if (
          localStorage.getItem(`${prefix}ProviderId`) === v.providerId &&
          localStorage.getItem(`${prefix}Key`) === v.modelKey
        ) {
          localStorage.setItem(`${prefix}Key`, v.replacement);
        }
      }

      setProviders((prev) =>
        prev.map((p) =>
          p.id === v.providerId
            ? {
                ...p,
                chatModels: [
                  ...p.chatModels.filter((m) => m.key !== v.modelKey),
                  { key: v.replacement!, name: v.replacement! },
                ],
              }
            : p,
        ),
      );
      toast.success(`Switched to ${v.replacement}.`);
      await load();
    } catch {
      toast.error('Could not switch model.');
    } finally {
      setBusy(null);
    }
  };

  const retryNow = async (b: BenchedModel) => {
    setBusy(b.key);
    try {
      await fetch('/api/models/status', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: b.key }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  };

  if (freeModels.length === 0 && benched.length === 0) return null;

  return (
    <section className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 lg:p-5 space-y-3">
      {freeModels.map((v) => (
        <div key={`free-${v.providerId}-${v.modelKey}`} className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
          <div className="flex items-start gap-2 min-w-0">
            <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-black/80 dark:text-white/80 break-words">
              <span className="font-medium">{v.providerName} · {v.modelKey}</span>{' '}
              {v.status === 'withdrawn' ? 'is no longer offered.' : 'is no longer free.'}
              {!v.replacement && ' No free replacement from the same vendor was found.'}
            </p>
          </div>
          {v.replacement && (
            <button
              onClick={() => switchModel(v)}
              disabled={busy !== null}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-[#24A0ED] text-white text-xs hover:bg-[#1a8fd4] disabled:opacity-50 transition"
            >
              Switch to {v.replacement}
            </button>
          )}
        </div>
      ))}
      {benched.map((b) => (
        <div key={`bench-${b.key}`} className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
          <div className="flex items-start gap-2 min-w-0">
            <PauseCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-black/80 dark:text-white/80 break-words">
              <span className="font-medium">{b.providerName} · {b.modelKey}</span>{' '}
              is paused ({BENCH_REASON[b.errorClass] ?? b.errorClass}) until{' '}
              {new Date(b.recoversAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              ; the fallback model is used meanwhile.
            </p>
          </div>
          <button
            onClick={() => retryNow(b)}
            disabled={busy !== null}
            className="shrink-0 px-3 py-1.5 rounded-lg border border-light-200 dark:border-dark-200 text-xs hover:bg-light-secondary dark:hover:bg-dark-secondary disabled:opacity-50 transition"
          >
            Retry now
          </button>
        </div>
      ))}
    </section>
  );
};

export default ModelStatus;
