"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

type Row = {
  id: string;
  body: string;
  createdAt: string;
  userId: string;
  shortCode: string;
  displayName: string | null;
};

export function GroupChatPanel({ groupId }: { groupId: string }) {
  const { data: session, status } = useSession();
  const selfId = session?.user?.id;
  const [rows, setRows] = useState<Row[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastCreatedRef = useRef<string | null>(null);

  async function fetchInitial() {
    const res = await fetch(`/api/groups/${groupId}/messages`);
    if (!res.ok) return;
    const data = (await res.json()) as Row[];
    setRows(data);
    if (data.length) {
      lastCreatedRef.current = data[data.length - 1]!.createdAt;
    } else {
      lastCreatedRef.current = null;
    }
  }

  async function fetchNew() {
    const since = lastCreatedRef.current;
    if (!since) return;
    const res = await fetch(
      `/api/groups/${groupId}/messages?since=${encodeURIComponent(since)}`
    );
    if (!res.ok) return;
    const data = (await res.json()) as Row[];
    if (data.length === 0) return;
    setRows((prev) => {
      const ids = new Set(prev.map((r) => r.id));
      const add = data.filter((r) => !ids.has(r.id));
      if (add.length === 0) return prev;
      const merged = [...prev, ...add].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      lastCreatedRef.current = merged[merged.length - 1]!.createdAt;
      return merged;
    });
  }

  useEffect(() => {
    void fetchInitial();
  }, [groupId]);

  useEffect(() => {
    const id = setInterval(() => void fetchNew(), 3000);
    return () => clearInterval(id);
  }, [groupId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [rows.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    const res = await fetch(`/api/groups/${groupId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: t }),
    });
    setSending(false);
    if (res.ok) {
      setText("");
      await fetchInitial();
    }
  }

  if (status === "loading") {
    return (
      <div className="py-4 text-center text-[13px] text-[var(--tg-text-secondary)]">
        Загрузка…
      </div>
    );
  }

  return (
    <div className="flex min-h-[320px] flex-col rounded-xl border border-[var(--tg-border)] bg-[var(--tg-sidebar)]">
      <div className="border-b border-[var(--tg-border)] px-3 py-2">
        <h3 className="text-[14px] font-semibold text-[var(--tg-text)]">Переписка в группе</h3>
        <p className="text-[13px] text-[var(--tg-text-secondary)]">
          Сообщения на сервере; личные чаты — в разделе «Чаты».
        </p>
      </div>
      <div className="tg-scroll max-h-[min(50vh,420px)] flex-1 overflow-y-auto px-2 py-2">
        {rows.map((m) => {
          const mine = m.userId === selfId;
          return (
            <div
              key={m.id}
              className={`mb-2 flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl px-3 py-2 text-[14px] leading-snug ${
                  mine
                    ? "rounded-br-sm bg-[var(--tg-accent)] text-white"
                    : "rounded-bl-sm bg-[var(--tg-search-bg)] text-[var(--tg-text)]"
                }`}
              >
                {!mine && (
                  <div className="mb-0.5 text-[11px] font-medium text-[var(--tg-text-secondary)]">
                    {m.displayName || m.shortCode}
                  </div>
                )}
                {m.body}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form
        onSubmit={send}
        className="flex gap-2 border-t border-[var(--tg-border)] p-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Сообщение в группу…"
          className="min-w-0 flex-1 rounded-lg border border-[var(--tg-border)] bg-white px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-[var(--tg-accent)]"
          maxLength={8000}
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="shrink-0 rounded-lg bg-[var(--tg-accent)] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-40"
        >
          Отпр.
        </button>
      </form>
    </div>
  );
}
