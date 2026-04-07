"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { DirectP2P } from "@/lib/chat/direct-p2p";
import {
  addDmMessage,
  getDmMessages,
  upsertContact,
  type DmMessageRow,
} from "@/lib/chat/local-db";

type Peer = { id: string; shortCode: string; displayName: string | null };

export function DmChatView({ peerId }: { peerId: string }) {
  const { data: session, status } = useSession();
  const selfId = session?.user?.id;
  const [peer, setPeer] = useState<Peer | null>(null);
  const [peerLoading, setPeerLoading] = useState(true);
  const [messages, setMessages] = useState<DmMessageRow[]>([]);
  const [text, setText] = useState("");
  const [conn, setConn] = useState<string>("connecting");
  const p2pRef = useRef<DirectP2P | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => {
      setPeerLoading(true);
      const res = await fetch(`/api/peers/${peerId}`);
      if (!res.ok) {
        setPeer(null);
        setPeerLoading(false);
        return;
      }
      const p = (await res.json()) as Peer;
      setPeer(p);
      await upsertContact({
        peerId: p.id,
        shortCode: p.shortCode,
        displayName: p.displayName,
        updatedAt: Date.now(),
      });
      setPeerLoading(false);
    })();
  }, [peerId]);

  useEffect(() => {
    void (async () => {
      const rows = await getDmMessages(peerId);
      setMessages(rows);
    })();
  }, [peerId]);

  useEffect(() => {
    if (status !== "authenticated" || !selfId || selfId === peerId) return;

    const p2p = new DirectP2P(
      selfId,
      peerId,
      async (incoming) => {
        const id = crypto.randomUUID();
        const row: DmMessageRow = {
          id,
          peerId,
          direction: "in",
          body: incoming,
          createdAt: Date.now(),
        };
        await addDmMessage(row);
        setMessages((m) => [...m, row]);
      },
      (s) => setConn(s)
    );
    p2pRef.current = p2p;
    void p2p.start();

    return () => {
      p2p.stop();
      p2pRef.current = null;
    };
  }, [selfId, peerId, status]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || !selfId) return;
    const id = crypto.randomUUID();
    const row: DmMessageRow = {
      id,
      peerId,
      direction: "out",
      body: t,
      createdAt: Date.now(),
    };
    await addDmMessage(row);
    setMessages((m) => [...m, row]);
    setText("");
    p2pRef.current?.send(t);
  }

  const title = peer?.displayName || peer?.shortCode || peerId.slice(0, 8);

  if (status === "loading" || peerLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-[14px] text-[var(--tg-text-secondary)]">
        Загрузка…
      </div>
    );
  }

  if (!peer) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4">
        <p className="text-[14px] text-[var(--tg-text-secondary)]">Контакт не найден</p>
        <Link href="/add" className="text-[14px] text-[var(--tg-accent)] hover:underline">
          Найти по коду
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-[3.25rem] shrink-0 items-center gap-2 border-b border-[var(--tg-border)] bg-[var(--tg-header)] px-2 md:px-4">
        <Link
          href="/chats"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--tg-accent)] md:hidden"
          aria-label="Назад"
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-semibold text-[var(--tg-text)]">{title}</h1>
          <p className="truncate text-[12px] text-[var(--tg-text-secondary)]">
            {conn === "connected" ? "онлайн (P2P)" : `связь: ${conn}`}
          </p>
        </div>
      </header>

      <div className="tg-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-[14px] leading-snug ${
                m.direction === "out"
                  ? "rounded-br-sm bg-[var(--tg-accent)] text-white"
                  : "rounded-bl-sm bg-[var(--tg-search-bg)] text-[var(--tg-text)]"
              }`}
            >
              {m.body}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={send}
        className="flex shrink-0 gap-2 border-t border-[var(--tg-border)] bg-[var(--tg-header)] p-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Сообщение…"
          className="min-w-0 flex-1 rounded-lg border border-[var(--tg-border)] bg-white px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-[var(--tg-accent)]"
          maxLength={4000}
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="shrink-0 rounded-lg bg-[var(--tg-accent)] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-40"
        >
          Отпр.
        </button>
      </form>
    </div>
  );
}
