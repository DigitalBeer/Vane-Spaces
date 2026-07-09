import Link from 'next/link';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';

export default function PinnedQueriesCard({ spaceId, initial }: { spaceId: string; initial: string[] }) {
  const [queries, setQueries] = useState<string[]>(initial ?? []);
  const [draft, setDraft] = useState('');

  const persist = (next: string[]) => {
    const prev = queries;
    setQueries(next);
    fetch(`/api/spaces/${spaceId}/pinned-queries`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pinnedQueries: next }) })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.pinnedQueries)) setQueries(d.pinnedQueries); })
      .catch(() => setQueries(prev));
  };

  const add = () => {
    const q = draft.trim();
    if (!q || queries.includes(q)) return;
    persist([...queries, q]);
    setDraft('');
  };

  const remove = (i: number) => persist(queries.filter((_, idx) => idx !== i));

  return (
    <div className="bg-light-secondary dark:bg-dark-secondary rounded-xl p-4 border border-light-200 dark:border-dark-200">
      <h2 className="font-semibold text-sm mb-1">Pinned Queries</h2>
      <p className="text-xs text-black/50 dark:text-white/50 mb-3">One-click starting points for this Space.</p>
      {queries.length === 0 && (
        <p className="text-xs text-black/40 dark:text-white/40">No pinned queries yet.</p>
      )}
      {queries.map((q, i) => (
        <div key={i} className="flex items-center justify-between gap-2 py-1">
          <Link href={`/?space=${spaceId}&q=${encodeURIComponent(q)}`} className="text-sm text-[#24A0ED] hover:underline truncate">{q}</Link>
          <button type="button" onClick={() => remove(i)} aria-label="Remove pinned query" className="text-black/40 dark:text-white/40 hover:text-red-500 shrink-0"><Trash2 size={14} /></button>
        </div>
      ))}
      <div className="mt-3 flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} placeholder="Add a query..." className="flex-1 text-sm bg-transparent border border-light-200 dark:border-dark-200 rounded-lg px-2 py-1 focus:outline-none" />
        <button type="button" onClick={add} className="text-sm px-3 py-1 rounded-lg bg-[#24A0ED] text-white hover:bg-[#1a8fd4]">Add</button>
      </div>
    </div>
  );
}
