"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { listDmConversations } from "@/lib/chat/local-db";

export function ChatListPanel() {
  const pathname = usePathname();
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listDmConversations>>>([]);

  useEffect(() => {
    void listDmConversations().then(setRows);
    const h = () => void listDmConversations().then(setRows);
    window.addEventListener("say-hello-chat-updated", h);
    return () => window.removeEventListener("say-hello-chat-updated", h);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col border-[var(--tg-border)] bg-[var(--tg-main)] md:border-r">
      <div className="border-b border-[var(--tg-border)] px-3 py-3">
        <h2 className="text-[15px] font-semibold text-[var(--tg-text)]">Все чаты</h2>
        <p className="text-[13px] text-[var(--tg-text-secondary)]">
          Личные — P2P, только на ваших устройствах
        </p>
      </div>
      <div className="tg-scroll flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-[var(--tg-text-secondary)]">
            Нет диалогов. Найдите человека в{" "}
            <Link href="/add" className="text-[var(--tg-accent)] hover:underline">
              Контактах
            </Link>
            .
          </div>
        ) : (
          <ul>
            {rows.map((c) => {
              const href = `/chats/dm/${c.peerId}`;
              const active = pathname === href;
              return (
                <li key={c.peerId} className="border-b border-[var(--tg-border)] last:border-0">
                  <Link
                    href={href}
                    className={`block px-3 py-3 transition-colors ${
                      active ? "bg-[var(--tg-accent-soft)]" : "hover:bg-[var(--tg-hover)]"
                    }`}
                  >
                    <span className="block truncate text-[14px] font-medium text-[var(--tg-text)]">
                      {c.displayName || c.shortCode || c.peerId.slice(0, 8)}
                    </span>
                    <span className="block truncate text-[12px] text-[var(--tg-text-secondary)]">
                      {c.preview}
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
