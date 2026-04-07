"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { useChatObfuscation } from "@/components/ChatObfuscationProvider";
import {
  getGroupMessagesLocal,
  saveGroupMessagesCache,
} from "@/lib/chat/local-db";
import { setGroupLastReadMs } from "@/lib/chat/read-state";

function notifyInboxRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("say-hello-inbox-refresh"));
  }
}

type Row = {
  id: string;
  body: string;
  imageDataUrl: string | null;
  createdAt: string;
  editedAt?: string | null;
  userId: string;
  shortCode: string;
  displayName: string | null;
};

export function GroupChatPanel({
  groupId,
  className = "",
}: {
  groupId: string;
  className?: string;
}) {
  const { data: session, status } = useSession();
  const { maskText, obfuscateEnabled } = useChatObfuscation();
  const selfId = session?.user?.id;
  const [rows, setRows] = useState<Row[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [messageEditWindowMinutes, setMessageEditWindowMinutes] = useState(30);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCreatedRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function toCacheSlice(rows: Row[]) {
    return rows.map((r) => ({
      id: r.id,
      body: r.body,
      imageDataUrl: r.imageDataUrl,
      createdAt: r.createdAt,
      editedAt: r.editedAt ?? null,
      userId: r.userId,
      shortCode: r.shortCode,
      displayName: r.displayName,
    }));
  }

  async function fetchInitial() {
    const cached = await getGroupMessagesLocal(groupId);
    if (cached.length > 0) {
      setRows(
        cached.map((c) => ({
          id: c.id,
          body: c.body,
          imageDataUrl: c.imageDataUrl,
          createdAt: c.createdAt,
          editedAt: c.editedAt ?? null,
          userId: c.userId,
          shortCode: c.shortCode,
          displayName: c.displayName,
        }))
      );
      lastCreatedRef.current = cached[cached.length - 1]!.createdAt;
    }
    const res = await fetch(`/api/groups/${groupId}/messages`);
    if (!res.ok) return;
    const data = (await res.json()) as Row[];
    await saveGroupMessagesCache(groupId, toCacheSlice(data));
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
      void saveGroupMessagesCache(groupId, toCacheSlice(merged));
      return merged;
    });
  }

  useEffect(() => {
    void fetchInitial();
  }, [groupId]);

  useEffect(() => {
    if (status !== "authenticated") return;
    void (async () => {
      const res = await fetch("/api/me", { credentials: "include" });
      if (!res.ok) return;
      const j = (await res.json()) as { messageEditWindowMinutes?: number };
      if (typeof j.messageEditWindowMinutes === "number") {
        setMessageEditWindowMinutes(j.messageEditWindowMinutes);
      }
    })();
  }, [status]);

  function withinEditWindow(createdAt: string) {
    const t = new Date(createdAt).getTime();
    return Date.now() - t <= Math.max(1, messageEditWindowMinutes) * 60_000;
  }

  async function editMine(m: Row) {
    const next = window.prompt("Новый текст", m.body.trim() || "");
    if (next === null) return;
    const t = next.trim();
    if (!t && !m.imageDataUrl) return;
    const res = await fetch(`/api/groups/${groupId}/messages/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ text: t || " " }),
    });
    if (res.ok) await fetchInitial();
  }

  async function deleteMine(m: Row) {
    if (!window.confirm("Удалить сообщение для всех в группе?")) return;
    const res = await fetch(`/api/groups/${groupId}/messages/${m.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) await fetchInitial();
  }

  useEffect(() => {
    const id = setInterval(() => void fetchNew(), 3000);
    return () => clearInterval(id);
  }, [groupId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [rows.length]);

  useEffect(() => {
    if (rows.length === 0) {
      setGroupLastReadMs(groupId, Date.now());
      return;
    }
    const last = rows[rows.length - 1]!;
    setGroupLastReadMs(groupId, new Date(last.createdAt).getTime());
  }, [groupId, rows]);

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
      notifyInboxRefresh();
    }
  }

  async function sendImage(f: File | null) {
    if (!f || sending) return;
    if (!f.type.startsWith("image/")) return;
    const b64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const s = String(r.result);
        const i = s.indexOf("base64,");
        resolve(i >= 0 ? s.slice(i + 7) : "");
      };
      r.onerror = () => reject(new Error("read"));
      r.readAsDataURL(f);
    });
    if (b64.length > 520_000) return;
    const mime = f.type === "image/png" ? "image/png" : f.type === "image/webp" ? "image/webp" : f.type === "image/gif" ? "image/gif" : "image/jpeg";
    setSending(true);
    const res = await fetch(`/api/groups/${groupId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64: b64,
        imageMime: mime,
        caption: text.trim() || undefined,
      }),
    });
    setSending(false);
    if (res.ok) {
      setText("");
      await fetchInitial();
      notifyInboxRefresh();
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  if (status === "loading") {
    return (
      <div
        className={`flex flex-1 items-center justify-center py-4 text-[13px] text-[var(--tg-text-secondary)] ${className}`}
      >
        Загрузка…
      </div>
    );
  }

  return (
    <div
      className={`chat-panel-shell flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--tg-border)] bg-[var(--tg-sidebar)] ${className}`}
    >
      <div
        ref={scrollRef}
        className="tg-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden"
      >
        <div className="mt-auto flex flex-col gap-0 px-2 py-2">
          {rows.map((m) => {
            const mine = m.userId === selfId;
            const canEdit = mine && withinEditWindow(m.createdAt);
            return (
              <div
                key={m.id}
                className={`mb-2 flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[min(90%,24rem)] overflow-hidden rounded-2xl px-3 py-2 text-[14px] leading-snug ${
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
                  {m.imageDataUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.imageDataUrl}
                      alt=""
                      className={`mb-1 max-h-64 max-w-full rounded-lg object-contain ${obfuscateEnabled ? "blur-xl" : ""}`}
                    />
                  )}
                  {m.body.trim() && m.body !== " " ? (
                    <span className={m.imageDataUrl ? "block pt-0.5" : ""}>
                      {maskText(m.body)}
                    </span>
                  ) : null}
                  {m.editedAt ? (
                    <span
                      className={`mt-0.5 block text-[10px] ${mine ? "text-white/70" : "opacity-70"}`}
                    >
                      изм.
                    </span>
                  ) : null}
                </div>
                {canEdit && (
                  <div className="flex gap-2 px-1">
                    <button
                      type="button"
                      onClick={() => void editMine(m)}
                      className="text-[11px] text-[var(--tg-accent)] hover:underline"
                    >
                      Правка
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteMine(m)}
                      className="text-[11px] text-red-600 hover:underline"
                    >
                      Удалить
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <form
        onSubmit={send}
        className="flex shrink-0 gap-2 border-t border-[var(--tg-border)] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] md:pb-2"
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void sendImage(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          disabled={sending}
          onClick={() => fileRef.current?.click()}
          className="shrink-0 rounded-lg border border-[var(--tg-border)] px-2 py-2 text-[13px] hover:bg-[var(--tg-hover)] disabled:opacity-40"
          title="Фото"
        >
          📷
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Сообщение или подпись к фото…"
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
