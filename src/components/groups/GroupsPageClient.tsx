"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CreateGroupModal } from "@/components/groups/CreateGroupModal";
import { getGroupLastReadMs } from "@/lib/chat/read-state";

export type GroupListItem = {
  id: string;
  name: string;
  role: string;
  lastMessageAt: string | null;
};

export function GroupsPageClient({ groups }: { groups: GroupListItem[] }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [, setReadTick] = useState(0);

  useEffect(() => {
    const h = () => setReadTick((x) => x + 1);
    window.addEventListener("say-hello-read-updated", h);
    return () => window.removeEventListener("say-hello-read-updated", h);
  }, []);

  function isUnread(g: GroupListItem) {
    if (!g.lastMessageAt) return false;
    const t = new Date(g.lastMessageAt).getTime();
    return t > getGroupLastReadMs(g.id);
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="tg-scroll flex-1 overflow-y-auto px-4 py-3">
        <ul className="flex flex-col gap-2">
          {groups.length === 0 && (
            <li className="rounded-xl border border-dashed border-[var(--tg-border)] px-4 py-8 text-center text-[14px] text-[var(--tg-text-secondary)]">
              Пока нет групп
            </li>
          )}
          {groups.map((g) => {
            const unread = isUnread(g);
            return (
              <li key={g.id}>
                <Link
                  href={`/groups/${g.id}`}
                  className="relative flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-main)] px-3 py-3 transition hover:bg-[var(--tg-hover)]"
                >
                  {unread && (
                    <span
                      className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-[var(--tg-accent)] shadow-sm"
                      aria-label="Новые сообщения"
                    />
                  )}
                  <span
                    className={`min-w-0 truncate pr-6 text-[15px] text-[var(--tg-text)] ${
                      unread ? "font-semibold" : "font-medium"
                    }`}
                  >
                    {g.name}
                  </span>
                  <span className="shrink-0 text-[13px] text-[var(--tg-text-secondary)]">
                    {g.role === "admin" ? "админ" : "участник"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        className="fixed right-3 z-40 flex h-11 min-w-0 items-center justify-center gap-0.5 rounded-full bg-[var(--tg-accent)] px-3 text-[12px] font-semibold text-white shadow-md transition hover:opacity-95 active:scale-95 bottom-[max(0.75rem,calc(3.75rem+env(safe-area-inset-bottom,0px)+0.35rem))] md:bottom-5 md:right-5 md:px-3.5"
        title="Новая группа"
        aria-label="Новая группа"
      >
        <span className="text-[15px] leading-none">+</span>
        <span className="max-w-[4.5rem] truncate sm:max-w-none">Группа</span>
      </button>

      <CreateGroupModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
