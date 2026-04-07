"use client";

import { useState } from "react";

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
    <div className="mt-6">
      <form onSubmit={lookup} className="flex flex-col gap-3 sm:flex-row">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Код"
          className="flex-1 rounded-xl border border-[var(--input-border)] bg-white px-3 py-2 font-mono text-sm tracking-wider outline-none focus:ring-2 focus:ring-[var(--accent)]"
          maxLength={16}
        />
        <button
          type="submit"
          disabled={loading || code.length < 4}
          className="rounded-full bg-[var(--accent)] px-6 py-2 text-sm font-medium text-[var(--accent-foreground)] disabled:opacity-50"
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
        <div className="mt-6 rounded-2xl bg-[var(--card)] p-5 shadow-sm ring-1 ring-[var(--ring)]">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            Найден пользователь
          </p>
          <p className="mt-2 font-mono text-lg">{result.shortCode}</p>
          {result.displayName && (
            <p className="mt-1 text-sm text-[var(--foreground)]">{result.displayName}</p>
          )}
          <p className="mt-3 text-xs text-[var(--muted)]">
            Внутренний ID (для P2P позже):{" "}
            <span className="break-all font-mono">{result.id}</span>
          </p>
        </div>
      )}
    </div>
  );
}
