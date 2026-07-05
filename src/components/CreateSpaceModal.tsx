'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { SpaceIcon as SpaceIconType } from '@/lib/db/schema';
import EmojiPicker from '@/components/EmojiPicker';

export interface CreatedSpace {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  icon: SpaceIconType | null;
  createdAt: string;
  updatedAt: string;
}

const COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#06b6d4',
  '#64748b',
  '#78716c',
];

const CreateSpaceModal = ({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (space: CreatedSpace) => void;
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState('#6366f1');
  const [emojiInput, setEmojiInput] = useState('');
  const [iconType, setIconType] = useState<'color' | 'emoji'>('color');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Portal target is only available on the client. Rendering to document.body
  // escapes ancestors with backdrop-filter/transform (e.g. the sticky Navbar),
  // which would otherwise become the containing block for this fixed overlay.
  useEffect(() => setMounted(true), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const icon =
        iconType === 'emoji' && emojiInput.trim()
          ? { type: 'emoji' as const, value: emojiInput.trim() }
          : { type: 'color' as const, value: selectedColor };

      const res = await fetch('/api/spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          icon,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || 'Failed to create space');
        return;
      }
      onCreated(data.space as CreatedSpace);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-light-primary dark:bg-dark-primary rounded-2xl border border-light-200 dark:border-dark-200 p-6 w-full max-w-md mx-4 shadow-xl">
        <h2 className="text-lg font-semibold mb-4">New Space</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm text-black/60 dark:text-white/60 mb-1">
              Name
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#24A0ED]"
              placeholder="e.g. Research, Work, Personal"
            />
          </div>
          <div>
            <label className="block text-sm text-black/60 dark:text-white/60 mb-1">
              Description (optional)
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#24A0ED]"
              placeholder="What is this Space for?"
            />
          </div>
          <div>
            <label className="block text-sm text-black/60 dark:text-white/60 mb-1">
              Icon
            </label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setIconType('color')}
                className={`px-3 py-1 text-xs rounded-full border transition ${iconType === 'color' ? 'bg-[#24A0ED] text-white border-[#24A0ED]' : 'border-light-200 dark:border-dark-200 text-black/60 dark:text-white/60'}`}
              >
                Color
              </button>
              <button
                type="button"
                onClick={() => setIconType('emoji')}
                className={`px-3 py-1 text-xs rounded-full border transition ${iconType === 'emoji' ? 'bg-[#24A0ED] text-white border-[#24A0ED]' : 'border-light-200 dark:border-dark-200 text-black/60 dark:text-white/60'}`}
              >
                Emoji
              </button>
            </div>
            {iconType === 'color' ? (
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    className={`w-7 h-7 rounded-lg transition ${selectedColor === c ? 'ring-2 ring-offset-2 ring-[#24A0ED] dark:ring-offset-dark-primary' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            ) : (
              <EmojiPicker value={emojiInput} onChange={setEmojiInput} />
            )}
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-light-200 dark:border-dark-200 hover:bg-light-secondary dark:hover:bg-dark-secondary transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-4 py-2 text-sm rounded-lg bg-[#24A0ED] text-white hover:bg-[#1a8fd4] disabled:opacity-50 transition"
            >
              {loading ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
};

export default CreateSpaceModal;
