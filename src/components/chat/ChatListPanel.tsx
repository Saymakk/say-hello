"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useChatObfuscation } from "@/components/ChatObfuscationProvider";
import { OnlineDot } from "@/components/chat/OnlineDot";
import { usePeerPresence } from "@/hooks/usePeerPresence";
import {
  loadUnifiedInboxRows,
  type UnifiedInboxRow,
} from "@/lib/chat/unified-inbox";
import { getDmLastReadMs, getGroupLastReadMs } from "@/lib/chat/read-state";

export function ChatListPanel() {
  const pathname = usePathname();
  const { maskText, obfuscateEnabled } = useChatObfuscation();
  const [rows, setRows] = useState<UnifiedInboxRow[]>([]);
  const [, setReadTick] = useState(0);

  const peerIds = useMemo(
    () => rows.filter((r) => r.kind === "dm").map((r) => r.peerId),
    [rows]
  );
  const presence = usePeerPresence(peerIds);

  const refresh = useCallback(() => {
    void loadUnifiedInboxRows().then(setRows);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, pathname]);

  useEffect(() => {
    const onChat = () => void refresh();
    const onInbox = () => void refresh();
    window.addEventListener("say-hello-chat-updated", onChat);
    window.addEventListener("say-hello-inbox-refresh", onInbox);
    return () => {
      window.removeEventListener("say-hello-chat-updated", onChat);
      window.removeEventListener("say-hello-inbox-refresh", onInbox);
    };
  }, [refresh]);

  useEffect(() => {
    const h = () => setReadTick((x) => x + 1);
    window.addEventListener("say-hello-read-updated", h);
    return () => window.removeEventListener("say-hello-read-updated", h);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col border-[var(--tg-border)] bg-[var(--tg-main)] md:border-r">
      <div className="tg-scroll flex-1 overflow-y-auto px-4 py-3">
        {rows.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-[var(--tg-text-secondary)]">
            Нет чатов. Найдите человека в{" "}
            <Link href="/add" className="text-[var(--tg-accent)] hover:underline">
              Контактах
            </Link>{" "}
            или откройте{" "}
            <Link href="/groups" className="text-[var(--tg-accent)] hover:underline">
              группы
            </Link>
            .
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((c) => {
              if (c.kind === "dm") {
                const href = `/chats/dm/${c.peerId}`;
                const active = pathname === href;
                const online = presence[c.peerId] ?? false;
                const unread =
                  c.lastDirection === "in" &&
                  c.lastAt > getDmLastReadMs(c.peerId);
                return (
                  <li key={`dm-${c.peerId}`}>
                    <Link
                      href={href}
                      className={`relative flex w-full flex-col gap-1 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-main)] px-3 py-3 transition hover:bg-[var(--tg-hover)] ${
                        active ? "ring-1 ring-[var(--tg-accent)]" : ""
                      }`}
                    >
                      {unread && (
                        <span
                          className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-[var(--tg-accent)] shadow-sm"
                          aria-label="Новые сообщения"
                        />
                      )}
                      <span className="flex w-full items-center justify-between gap-3">
                        <span className="flex min-w-0 flex-1 items-center gap-2 pr-6">
                          <OnlineDot online={online} />
                          <span
                            className={`truncate text-[15px] text-[var(--tg-text)] ${
                              unread ? "font-semibold" : "font-medium"
                            }`}
                          >
                            {c.label}
                          </span>
                        </span>
                        <span className="shrink-0 text-[13px] text-[var(--tg-text-secondary)]">
                          {online ? "в сети" : "не в сети"}
                        </span>
                      </span>
                      <span className="block truncate pl-4 text-[13px] text-[var(--tg-text-secondary)]">
                        {obfuscateEnabled ? maskText(c.preview) : c.preview}
                      </span>
                    </Link>
                  </li>
                );
              }

              const href = `/groups/${c.groupId}`;
              const active =
                pathname === href || pathname.startsWith(`${href}/`);
              const unread =
                !!c.lastMessageAt &&
                new Date(c.lastMessageAt).getTime() >
                  getGroupLastReadMs(c.groupId);
              return (
                <li key={`g-${c.groupId}`}>
                  <Link
                    href={href}
                    className={`relative flex w-full flex-col gap-1 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-main)] px-3 py-3 transition hover:bg-[var(--tg-hover)] ${
                      active ? "ring-1 ring-[var(--tg-accent)]" : ""
                    }`}
                  >
                    {unread && (
                      <span
                        className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-[var(--tg-accent)] shadow-sm"
                        aria-label="Новые сообщения"
                      />
                    )}
                    <span className="flex w-full items-center justify-between gap-3">
                      <span className="flex min-w-0 flex-1 items-center gap-2 pr-6">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--tg-search-bg)] text-[var(--tg-text-secondary)]"
                          aria-hidden
                        >
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                          >
                            <path
                              d="M17 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                        <span
                          className={`truncate text-[15px] text-[var(--tg-text)] ${
                            unread ? "font-semibold" : "font-medium"
                          }`}
                        >
                          {c.label}
                        </span>
                      </span>
                      <span className="shrink-0 text-[13px] text-[var(--tg-text-secondary)]">
                        группа
                      </span>
                    </span>
                    <span className="block truncate pl-12 text-[13px] text-[var(--tg-text-secondary)]">
                      {obfuscateEnabled ? maskText(c.preview) : c.preview}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
