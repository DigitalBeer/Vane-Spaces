'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Loader2, Newspaper, Plus, Trash2, X } from 'lucide-react';
import CreateDigestModal from '@/components/CreateDigestModal';

type DigestTopic = { id: string; name: string; enabled: boolean; frequency: 'daily' | 'weekly'; timeOfDay: string; dayOfWeek: number | null; nextRunAt: string; lastRunAt: string | null; lastRunError: string | null };
type EntrySource = { title: string; url: string };
type DigestEntry = { chatId: string; title: string; createdAt: string; statuses: (string | null)[]; snippet: string; sources: EntrySource[] };

const DigestsPage = () => {
  const [digests, setDigests] = useState<DigestTopic[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [entries, setEntries] = useState<DigestEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const activeIdRef = useRef<string | null>(null);

  const loadEntries = async (digestId: string, pageNum: number, append: boolean): Promise<void> => {
    const res = await fetch(`/api/digests/${digestId}/entries?page=${pageNum}&limit=20`);
    const data: { entries?: DigestEntry[]; hasMore?: boolean } = await res.json();
    if (activeIdRef.current !== digestId) return;
    if (append) {
      setEntries((prev) => [...prev, ...(data.entries ?? [])]);
    } else {
      setEntries(data.entries ?? []);
    }
    setHasMore(data.hasMore ?? false);
    setPage(pageNum);
  };

  const loadDigests = useCallback(async (): Promise<DigestTopic[]> => {
    const res = await fetch('/api/digests');
    const data = await res.json();
    const list: DigestTopic[] = data.digests ?? [];
    setDigests(list);
    return list;
  }, []);

  useEffect(() => {
    loadDigests().then((list: DigestTopic[]) => {
      setActiveId((prev: string | null) => prev ?? (list[0]?.id ?? null));
      setLoading(false);
    });
  }, [loadDigests]);

  useEffect(() => {
    activeIdRef.current = activeId;
    if (!activeId) {
      setEntries([]);
      setHasMore(false);
      setPage(1);
      return;
    }
    setPage(1);
    loadEntries(activeId, 1, false).catch(() => { if (activeIdRef.current === activeId) setEntries([]); });
  }, [activeId]);

  const active: DigestTopic | undefined = digests.find((d: DigestTopic) => d.id === activeId);

  const toggleEnabled = async (d: DigestTopic): Promise<void> => {
    await fetch(`/api/digests/${d.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !d.enabled }) });
    await loadDigests();
  };

  const deleteDigest = async (d: DigestTopic): Promise<void> => {
    if (!confirm(`Delete digest "${d.name}"? Its past briefings stay in history.`)) return;
    await fetch(`/api/digests/${d.id}`, { method: 'DELETE' });
    const list = await loadDigests();
    setActiveId(list[0]?.id ?? null);
  };

  const downvote = async (url: string): Promise<void> => {
    if (!activeId) return;
    const res = await fetch(`/api/digests/${activeId}/downvote`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
    if (res.ok) toast.success('Publisher muted for this topic'); else toast.error('Failed to mute');
  };

  const onCreated = async (): Promise<void> => {
    const list = await loadDigests();
    setActiveId(list[list.length - 1]?.id ?? null);
  };

  const loadMore = async (): Promise<void> => {
    if (!activeId || loadingMore) return;
    setLoadingMore(true);
    try {
      await loadEntries(activeId, page + 1, true);
    } catch {
      /* leave existing entries as-is */
    } finally {
      setLoadingMore(false);
    }
  };

  const domainOf = (url: string): string => {
    try { let h = new URL(url).hostname; if (h.startsWith('www.')) h = h.slice(4); return h; } catch { return url; }
  };

  return (
    <div>
      <div className="pt-10 border-b pb-6 px-2 flex flex-row items-center justify-between">
        <div className="flex flex-row items-center gap-2">
          <Newspaper size={40} />
          <h1 className="text-4xl font-normal p-2" style={{ fontFamily: 'PP Editorial, serif' }}>Digests</h1>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg bg-[#24A0ED] text-white hover:bg-[#1a8fd4] transition">
          <Plus size={16} /> New Digest
        </button>
      </div>
      {digests.length > 0 && (
        <div className="flex flex-row items-center space-x-2 overflow-x-auto mt-4">
          {digests.map((d: DigestTopic) => (
            <button
              key={d.id}
              onClick={() => setActiveId(d.id)}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg ${
                d.id === activeId ? 'text-cyan-700 dark:text-cyan-300 bg-cyan-300/20 border-cyan-700/60' : 'border border-light-200 dark:border-dark-200'
              }`}
            >
              {d.name}
              {!d.enabled && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500">muted</span>}
            </button>
          ))}
        </div>
      )}
      {active && (
        <div className="flex flex-row items-center space-x-4 mt-4">
          <p>{`${active.frequency === 'weekly' ? 'Weekly' : 'Daily'} at ${active.timeOfDay}`}</p>
          <button onClick={() => toggleEnabled(active)} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[#24A0ED] text-white hover:bg-[#1a8fd4] transition">
            {active.enabled ? 'Enabled' : 'Disabled'}
          </button>
          <button onClick={() => deleteDigest(active)} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-red-500 hover:bg-red-600 transition">
            <Trash2 size={14} />
          </button>
          {active.lastRunError && <p className="text-xs text-red-500">{active.lastRunError}</p>}
        </div>
      )}
      {loading && <p>Loading…</p>}
      {digests.length === 0 && !loading && <p>No digest topics yet. Create one to get scheduled briefings on the topics you follow.</p>}
      {digests.length > 0 && entries.length === 0 && !loading && <p>No briefings yet — the next run is scheduled. {active?.nextRunAt && <time dateTime={active.nextRunAt}>{new Date(active.nextRunAt).toLocaleString()}</time>}</p>}
      {entries.length > 0 && !loading && (
        <div>
          {entries.map((entry: DigestEntry) => (
            <div key={entry.chatId} className="rounded-xl border border-light-200 dark:border-dark-200 p-4 mb-4 bg-light-secondary dark:bg-dark-secondary">
              <div className="flex flex-row items-center justify-between">
                <Link href={`/c/${entry.chatId}`} className="text-lg font-medium hover:underline">{entry.title}</Link>
                {entry.statuses.includes('error') && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500">partial</span>}
              </div>
              <p className="text-xs text-black/40 dark:text-white/40">{new Date(entry.createdAt).toLocaleString()}</p>
              <p className="text-sm text-black/70 dark:text-white/70 mt-2">{entry.snippet}</p>
              {entry.sources.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {entry.sources.map((s: EntrySource) => (
                    <span key={s.url} className="inline-flex items-center gap-1 text-xs rounded-full border border-light-200 dark:border-dark-200 px-2 py-1">
                      <img src={`https://s2.googleusercontent.com/s2/favicons?domain_url=${s.url}`} className="w-3 h-3" alt="" />
                      {domainOf(s.url)}
                      <button onClick={() => downvote(s.url)} title="Mute this publisher">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {hasMore && !loading && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#24A0ED] text-white text-sm hover:bg-[#1a8fd4] disabled:opacity-50 transition"
            >
              {loadingMore ? (
                <Loader2 size={14} className="animate-spin" />
              ) : null}
              Load more
            </button>
          )}
        </div>
      )}
      {showCreate && <CreateDigestModal onClose={() => setShowCreate(false)} onCreated={onCreated} />}
    </div>
  );
};

export default DigestsPage;
