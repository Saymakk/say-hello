"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { notifyInboxAndSidebarRefresh } from "@/lib/chat/inbox-events";
import { upsertContact } from "@/lib/chat/local-db";

type Lookup = {
  id: string;
  phone: string;
  shortCode: string;
  displayName: string | null;
};

export function ComposeDmModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<Lookup | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    const res = await fetch(
      `/api/users/lookup?phone=${encodeURIComponent(phone.trim())}`
    );
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Ошибка");
      return;
    }
    const r = data as Lookup;
    setResult(r);
    await upsertContact({
      peerId: r.id,
      shortCode: r.phone || r.shortCode,
      displayName: r.displayName,
      updatedAt: Date.now(),
    });
    notifyInboxAndSidebarRefresh();
  }

  async function sendRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!result) return;
    setError(null);
    setLoading(true);
    const res = await fetch("/api/dm/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toUserId: result.id,
        firstMessagePreview: preview.trim() || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Не удалось отправить запрос");
      return;
    }
    notifyInboxAndSidebarRefresh();
    onClose();
    router.push(`/chats/dm/${result.id}`);
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="compose-dm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--tg-border)] bg-[var(--tg-main)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 id="compose-dm-title" className="text-[16px] font-semibold text-[var(--tg-text)]">
            Написать
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-[14px] text-[var(--tg-text-secondary)] hover:bg-[var(--tg-hover)]"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
        <p className="mt-1 text-[13px] text-[var(--tg-text-secondary)]">
          Найдите по номеру и отправьте запрос на переписку. Собеседник увидит ваши публичные данные и
          сможет принять или отклонить.
        </p>

        <form onSubmit={lookup} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Телефон"
            className="min-w-0 flex-1 rounded-lg border border-[var(--tg-border)] bg-white px-3 py-2 font-mono text-[14px] tracking-wider outline-none focus:ring-2 focus:ring-[var(--tg-accent)]"
            maxLength={20}
          />
          <button
            type="submit"
            disabled={loading || phone.trim().length < 10}
            className="rounded-lg bg-[var(--tg-accent)] px-5 py-2 text-[14px] font-medium text-white disabled:opacity-50"
          >
            {loading ? "…" : "Найти"}
          </button>
        </form>

        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        {result && (
          <div className="mt-4 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-sidebar)] p-4">
            <p className="font-mono text-lg text-[var(--tg-text)]">{result.phone}</p>
            {result.displayName && (
              <p className="mt-1 text-[14px] text-[var(--tg-text)]">{result.displayName}</p>
            )}
            <label className="mt-3 block text-[12px] text-[var(--tg-text-secondary)]">
              Первое сообщение (необязательно, как превью к запросу)
            </label>
            <textarea
              value={preview}
              onChange={(e) => setPreview(e.target.value)}
              placeholder="Текст…"
              rows={2}
              maxLength={400}
              className="mt-1 w-full rounded-lg border border-[var(--tg-border)] bg-white px-3 py-2 text-[14px]"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={sendRequest}
                disabled={loading}
                className="rounded-lg bg-[var(--tg-accent)] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-50"
              >
                {loading ? "…" : "Отправить запрос"}
              </button>
              <Link
                href={`/chats/dm/${result.id}`}
                onClick={onClose}
                className="rounded-lg border border-[var(--tg-border)] px-4 py-2 text-[14px] text-[var(--tg-text)] hover:bg-[var(--tg-hover)]"
              >
                Открыть чат
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
