"use client";

import Link from "next/link";
import { useState } from "react";
import { upsertContact } from "@/lib/chat/local-db";

type Lookup = {
  id: string;
  shortCode: string;
  displayName: string | null;
};

export function AddByCodeClient({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode);
  const [result, setResult] = useState<Lookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    const res = await fetch(
      `/api/users/lookup?code=${encodeURIComponent(code.trim())}`
    );
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Ошибка");
      return;
    }
    setResult(data as Lookup);
  }

  return (
    <div className="mt-2">
      <form onSubmit={lookup} className="flex flex-col gap-3 sm:flex-row">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Код"
          className="flex-1 rounded-lg border border-[var(--tg-border)] bg-white px-3 py-2 font-mono text-[14px] tracking-wider outline-none focus:ring-2 focus:ring-[var(--tg-accent)]"
          maxLength={16}
        />
        <button
          type="submit"
          disabled={loading || code.length < 4}
          className="rounded-lg bg-[var(--tg-accent)] px-6 py-2 text-[14px] font-medium text-white disabled:opacity-50"
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
        <div className="mt-6 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-sidebar)] p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--tg-text-secondary)]">
            Найден пользователь
          </p>
          <p className="mt-2 font-mono text-lg text-[var(--tg-text)]">{result.shortCode}</p>
          {result.displayName && (
            <p className="mt-1 text-[14px] text-[var(--tg-text)]">{result.displayName}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/chats/dm/${result.id}`}
              onClick={() => {
                void upsertContact({
                  peerId: result.id,
                  shortCode: result.shortCode,
                  displayName: result.displayName,
                  updatedAt: Date.now(),
                });
              }}
              className="inline-flex rounded-lg bg-[var(--tg-accent)] px-4 py-2 text-[14px] font-medium text-white hover:opacity-90"
            >
              Написать
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
