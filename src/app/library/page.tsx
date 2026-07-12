'use client';

import DeleteChat from '@/components/DeleteChat';
import MoveToSpace from '@/components/MoveToSpace';
import CreateSpaceModal, { CreatedSpace } from '@/components/CreateSpaceModal';
import { formatTimeDifference } from '@/lib/utils';
import {
  BookOpenText,
  Check,
  ClockIcon,
  FileText,
  Globe2Icon,
  LayoutGrid,
  Newspaper,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  Description,
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import Link from 'next/link';
import { Fragment, useEffect, useState } from 'react';
import { toast } from 'sonner';

interface SpaceInfo {
  id: string;
  name: string;
  icon: { type: 'emoji' | 'color'; value: string } | null;
}

interface DigestInfo {
  id: string;
  name: string;
}

export interface Chat {
  id: string;
  title: string;
  createdAt: string;
  sources: string[];
  files: { fileId: string; name: string }[];
  spaceId: string | null;
  space: SpaceInfo | null;
  digest: DigestInfo | null;
}

const SpaceIconMini = ({ icon }: { icon: SpaceInfo['icon'] }) => {
  if (!icon) return <div className="w-5 h-5 rounded bg-indigo-500/30" />;
  if (icon.type === 'emoji') {
    return (
      <span className="w-5 h-5 flex items-center justify-center text-sm leading-none">
        {icon.value}
      </span>
    );
  }
  return (
    <div className="w-5 h-5 rounded" style={{ backgroundColor: icon.value }} />
  );
};

const BulkMoveMenu = ({
  disabled,
  onMove,
  hasSpaced,
}: {
  disabled: boolean;
  onMove: (spaceId: string | null, space: SpaceInfo | null) => void;
  hasSpaced: boolean;
}) => {
  const [spaces, setSpaces] = useState<SpaceInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const fetchSpaces = async () => {
    if (spaces.length > 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/spaces');
      if (res.ok) {
        const data = await res.json();
        setSpaces(
          data.spaces.map((s: any) => ({
            id: s.id,
            name: s.name,
            icon: s.icon,
          })),
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreated = (created: CreatedSpace) => {
    const space: SpaceInfo = {
      id: created.id,
      name: created.name,
      icon: created.icon,
    };
    setSpaces((prev) => [space, ...prev]);
    setShowCreate(false);
    onMove(created.id, space);
  };

  return (
    <>
      <Popover className="relative">
        {({ close }) => (
          <>
            <PopoverButton
              onClick={fetchSpaces}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-light-200 dark:border-dark-200 hover:bg-light-secondary dark:hover:bg-dark-secondary disabled:opacity-50 transition"
            >
              <LayoutGrid size={14} />
              Move to Space
            </PopoverButton>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-200"
              enterFrom="opacity-0 -translate-y-1"
              enterTo="opacity-100 translate-y-0"
              leave="transition ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 -translate-y-1"
            >
              <PopoverPanel className="absolute right-0 bottom-full mb-2 w-64 origin-bottom-right rounded-2xl bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 shadow-xl shadow-black/10 dark:shadow-black/30 z-50">
                <div className="p-3">
                  <p className="text-xs font-medium text-black/40 dark:text-white/40 uppercase tracking-wide mb-2">
                    Move to Space
                  </p>
                  {loading ? (
                    <p className="text-xs text-black/40 dark:text-white/40 py-2 text-center">
                      Loading…
                    </p>
                  ) : spaces.length === 0 ? (
                    <p className="text-xs text-black/40 dark:text-white/40 py-2 text-center">
                      No Spaces yet
                    </p>
                  ) : (
                    <div className="space-y-0.5 max-h-56 overflow-y-auto">
                      {spaces.map((space) => (
                        <button
                          key={space.id}
                          disabled={disabled}
                          onClick={() => {
                            onMove(space.id, space);
                            close();
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-light-secondary dark:hover:bg-dark-secondary transition-colors duration-150"
                        >
                          <SpaceIconMini icon={space.icon} />
                          <span className="flex-1 text-sm text-black dark:text-white truncate">
                            {space.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="border-t border-light-200 dark:border-dark-200 my-2" />
                  <button
                    disabled={disabled}
                    onClick={() => {
                      close();
                      setShowCreate(true);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-light-secondary dark:hover:bg-dark-secondary transition-colors duration-150"
                  >
                    <Plus size={14} className="text-[#24A0ED]" />
                    <span className="text-sm text-[#24A0ED] font-medium">
                      New Space
                    </span>
                  </button>
                  {hasSpaced && (
                    <button
                      disabled={disabled}
                      onClick={() => {
                        onMove(null, null);
                        close();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-150"
                    >
                      <X size={14} className="text-red-500" />
                      <span className="text-sm text-red-500">
                        Remove from Space
                      </span>
                    </button>
                  )}
                </div>
              </PopoverPanel>
            </Transition>
          </>
        )}
      </Popover>
      {showCreate && (
        <CreateSpaceModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
};

const Page = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const selectionMode = selectedIds.size > 0;

  useEffect(() => {
    const fetchChats = async () => {
      setLoading(true);

      const res = await fetch(`/api/chats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();

      setChats(data.chats);
      setLoading(false);
    };

    fetchChats();
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const performBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const results = await Promise.allSettled(
        ids.map((id) => fetch(`/api/chats/${id}`, { method: 'DELETE' })),
      );
      const failed = results.filter(
        (r) =>
          r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok),
      ).length;
      const deleted = ids.filter((_, i) => {
        const r = results[i];
        return r.status === 'fulfilled' && r.value.ok;
      });
      const deletedSet = new Set(deleted);
      setChats((prev) => prev.filter((c) => !deletedSet.has(c.id)));
      clearSelection();
      if (failed > 0) {
        toast.error(
          `Deleted ${deleted.length}, failed ${failed}. Please retry the rest.`,
        );
      } else {
        toast.success(
          `Deleted ${deleted.length} ${deleted.length === 1 ? 'chat' : 'chats'}`,
        );
      }
    } finally {
      setBulkBusy(false);
      setConfirmDeleteOpen(false);
    }
  };

  const bulkMove = async (spaceId: string | null, space: SpaceInfo | null) => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const results = await Promise.allSettled(
        ids.map((id) =>
          fetch(`/api/chats/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ spaceId }),
          }),
        ),
      );
      const failed = results.filter(
        (r) =>
          r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok),
      ).length;
      const moved = new Set(
        ids.filter((_, i) => {
          const r = results[i];
          return r.status === 'fulfilled' && r.value.ok;
        }),
      );
      setChats((prev) =>
        prev.map((c) => (moved.has(c.id) ? { ...c, spaceId, space } : c)),
      );
      clearSelection();
      if (failed > 0) {
        toast.error(`Moved ${moved.size}, failed ${failed}.`);
      } else if (spaceId) {
        toast.success(`Moved ${moved.size} to ${space?.name}`);
      } else {
        toast.success(`Removed ${moved.size} from Space`);
      }
    } finally {
      setBulkBusy(false);
    }
  };

  const anySelectedSpaced = chats.some(
    (c) => selectedIds.has(c.id) && c.spaceId,
  );

  return (
    <div>
      <div className="flex flex-col pt-10 border-b border-light-200/20 dark:border-dark-200/20 pb-6 px-2">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
          <div className="flex items-center justify-center">
            <BookOpenText size={45} className="mb-2.5" />
            <div className="flex flex-col">
              <h1
                className="text-5xl font-normal p-2 pb-0"
                style={{ fontFamily: 'PP Editorial, serif' }}
              >
                Library
              </h1>
              <div className="px-2 text-sm text-black/60 dark:text-white/60 text-center lg:text-left">
                Past chats, sources, and uploads.
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center lg:justify-end gap-2 text-xs text-black/60 dark:text-white/60">
            <span className="inline-flex items-center gap-1 rounded-full border border-black/20 dark:border-white/20 px-2 py-0.5">
              <BookOpenText size={14} />
              {loading
                ? 'Loading…'
                : `${chats.length} ${chats.length === 1 ? 'chat' : 'chats'}`}
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-row items-center justify-center min-h-[60vh]">
          <svg
            aria-hidden="true"
            className="w-8 h-8 text-light-200 fill-light-secondary dark:text-[#202020] animate-spin dark:fill-[#ffffff3b]"
            viewBox="0 0 100 101"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M100 50.5908C100.003 78.2051 78.1951 100.003 50.5908 100C22.9765 99.9972 0.997224 78.018 1 50.4037C1.00281 22.7993 22.8108 0.997224 50.4251 1C78.0395 1.00281 100.018 22.8108 100 50.4251ZM9.08164 50.594C9.06312 73.3997 27.7909 92.1272 50.5966 92.1457C73.4023 92.1642 92.1298 73.4365 92.1483 50.6308C92.1669 27.8251 73.4392 9.0973 50.6335 9.07878C27.8278 9.06026 9.10003 27.787 9.08164 50.594Z"
              fill="currentColor"
            />
            <path
              d="M93.9676 39.0409C96.393 38.4037 97.8624 35.9116 96.9801 33.5533C95.1945 28.8227 92.871 24.3692 90.0681 20.348C85.6237 14.1775 79.4473 9.36872 72.0454 6.45794C64.6435 3.54717 56.3134 2.65431 48.3133 3.89319C45.869 4.27179 44.3768 6.77534 45.014 9.20079C45.6512 11.6262 48.1343 13.0956 50.5786 12.717C56.5073 11.8281 62.5542 12.5399 68.0406 14.7911C73.527 17.0422 78.2187 20.7487 81.5841 25.4923C83.7976 28.5886 85.4467 32.059 86.4416 35.7474C87.1273 38.1189 89.5423 39.6781 91.9676 39.0409Z"
              fill="currentFill"
            />
          </svg>
        </div>
      ) : chats.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-2 text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary">
            <BookOpenText className="text-black/70 dark:text-white/70" />
          </div>
          <p className="mt-2 text-black/70 dark:text-white/70 text-sm">
            No chats found.
          </p>
          <p className="mt-1 text-black/70 dark:text-white/70 text-sm">
            <Link href="/" className="text-sky-400">
              Start a new chat
            </Link>{' '}
            to see it listed here.
          </p>
        </div>
      ) : (
        <div className="pt-6 pb-28 px-2">
          <div className="rounded-2xl border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary">
            {chats.map((chat, index) => {
              const sourcesLabel =
                chat.sources.length === 0
                  ? null
                  : chat.sources.length <= 2
                    ? chat.sources
                        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                        .join(', ')
                    : `${chat.sources
                        .slice(0, 2)
                        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                        .join(', ')} + ${chat.sources.length - 2}`;

              const selected = selectedIds.has(chat.id);

              return (
                <div
                  key={chat.id}
                  className={
                    'group flex flex-col gap-2 p-4 transition-colors duration-200 ' +
                    (selected
                      ? 'bg-[#24A0ED]/5 dark:bg-[#24A0ED]/10 '
                      : 'hover:bg-light-secondary dark:hover:bg-dark-secondary ') +
                    (index !== chats.length - 1
                      ? 'border-b border-light-200 dark:border-dark-200'
                      : '')
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => toggleSelect(chat.id)}
                        aria-label={selected ? 'Deselect chat' : 'Select chat'}
                        className={
                          'mt-0.5 shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-colors duration-150 ' +
                          (selected
                            ? 'bg-[#24A0ED] border-[#24A0ED] text-white'
                            : 'border-black/25 dark:border-white/25 text-transparent ' +
                              (selectionMode
                                ? 'opacity-100'
                                : 'opacity-0 group-hover:opacity-100'))
                        }
                      >
                        <Check size={14} />
                      </button>
                      <Link
                        href={`/c/${chat.id}`}
                        className="flex-1 text-black dark:text-white text-base lg:text-lg font-medium leading-snug line-clamp-2 group-hover:text-[#24A0ED] transition duration-200"
                        title={chat.title}
                      >
                        {chat.title}
                      </Link>
                    </div>
                    {!selectionMode && (
                      <div className="flex items-center gap-1 pt-0.5 shrink-0">
                        <MoveToSpace
                          chatId={chat.id}
                          currentSpaceId={chat.spaceId}
                          popoverDirection="up"
                          onMoved={(newSpaceId, spaceInfo) => {
                            setChats((prev) =>
                              prev.map((c) =>
                                c.id === chat.id
                                  ? {
                                      ...c,
                                      spaceId: newSpaceId,
                                      space: spaceInfo,
                                    }
                                  : c,
                              ),
                            );
                          }}
                          buttonClassName="p-1.5 rounded-lg hover:bg-light-secondary dark:hover:bg-dark-secondary transition-colors duration-200 opacity-0 group-hover:opacity-100"
                        />
                        <DeleteChat
                          chatId={chat.id}
                          chats={chats}
                          setChats={setChats}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-black/70 dark:text-white/70 pl-8">
                    <div className="flex flex-wrap items-center gap-2 flex-1">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <ClockIcon size={14} />
                        {formatTimeDifference(new Date(), chat.createdAt)} Ago
                      </span>

                      {sourcesLabel && (
                        <span className="inline-flex items-center gap-1 text-xs border border-black/20 dark:border-white/20 rounded-full px-2 py-0.5">
                          <Globe2Icon size={14} />
                          {sourcesLabel}
                        </span>
                      )}
                      {chat.files.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs border border-black/20 dark:border-white/20 rounded-full px-2 py-0.5">
                          <FileText size={14} />
                          {chat.files.length}{' '}
                          {chat.files.length === 1 ? 'file' : 'files'}
                        </span>
                      )}
                    </div>
                    {chat.space && (
                      <Link
                        href={`/spaces/${chat.space.id}`}
                        className="inline-flex items-center gap-1 text-xs border border-black/20 dark:border-white/20 rounded-full px-2 py-0.5 hover:text-[#24A0ED] transition-colors duration-150 shrink-0"
                      >
                        {chat.space.icon?.type === 'emoji' ? (
                          <span className="text-sm leading-none">
                            {chat.space.icon.value}
                          </span>
                        ) : chat.space.icon?.type === 'color' ? (
                          <div
                            className="w-3 h-3 rounded"
                            style={{ backgroundColor: chat.space.icon.value }}
                          />
                        ) : (
                          <div className="w-3 h-3 rounded bg-indigo-500/30" />
                        )}
                        {chat.space.name}
                      </Link>
                    )}
                    {chat.digest && (
                      <Link
                        href={`/digests?topic=${chat.digest.id}`}
                        className="inline-flex items-center gap-1 text-xs border border-black/20 dark:border-white/20 rounded-full px-2 py-0.5 hover:text-[#24A0ED] transition-colors duration-150 shrink-0"
                      >
                        <Newspaper size={12} />
                        {chat.digest.name}
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectionMode && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4 lg:pl-[72px] pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-light-200 dark:border-dark-200 bg-light-primary/95 dark:bg-dark-primary/95 backdrop-blur-sm shadow-xl shadow-black/10 dark:shadow-black/40 px-3 py-2">
            <button
              onClick={clearSelection}
              className="p-1.5 rounded-lg hover:bg-light-secondary dark:hover:bg-dark-secondary transition"
              title="Clear selection"
            >
              <X size={16} className="text-black/60 dark:text-white/60" />
            </button>
            <span className="text-sm font-medium px-1">
              {selectedIds.size} selected
            </span>
            <div className="w-px h-6 bg-light-200 dark:bg-dark-200 mx-1" />
            <BulkMoveMenu
              disabled={bulkBusy}
              onMove={bulkMove}
              hasSpaced={anySelectedSpaced}
            />
            <button
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </div>
      )}

      <Transition appear show={confirmDeleteOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[60]"
          onClose={() => {
            if (!bulkBusy) setConfirmDeleteOpen(false);
          }}
        >
          <DialogBackdrop className="fixed inset-0 bg-black/30" />
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-200"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <DialogPanel className="w-full max-w-md transform rounded-2xl bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 p-6 text-left align-middle shadow-xl transition-all">
                  <DialogTitle className="text-lg font-medium leading-6 dark:text-white">
                    Delete Confirmation
                  </DialogTitle>
                  <Description className="text-sm dark:text-white/70 text-black/70 mt-1">
                    Are you sure you want to delete {selectedIds.size}{' '}
                    {selectedIds.size === 1 ? 'chat' : 'chats'}? This cannot be
                    undone.
                  </Description>
                  <div className="flex flex-row items-end justify-end space-x-4 mt-6">
                    <button
                      onClick={() => {
                        if (!bulkBusy) setConfirmDeleteOpen(false);
                      }}
                      className="text-black/50 dark:text-white/50 text-sm hover:text-black/70 hover:dark:text-white/70 transition duration-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={performBulkDelete}
                      disabled={bulkBusy}
                      className="text-red-400 text-sm hover:text-red-500 disabled:opacity-50 transition duration-200"
                    >
                      {bulkBusy ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

export default Page;
