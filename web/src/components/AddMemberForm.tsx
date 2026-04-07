"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AddMemberForm({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [shortCode, setShortCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    const res = await fetch(`/api/groups/${groupId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shortCode: shortCode.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMessage(typeof data.error === "string" ? data.error : "Ошибка");
      return;
    }
    setShortCode("");
    setMessage("Участник добавлен");
    router.refresh();
  }

  return (
    <form
      onSubmit={add}
      className="mt-6 rounded-2xl bg-[var(--card)] p-5 shadow-sm ring-1 ring-[var(--ring)]"
    >
      <h2 className="text-sm font-medium text-[var(--foreground)]">
        Добавить по коду
      </h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Введите короткий код человека — он получит роль участника.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={shortCode}
          onChange={(e) => setShortCode(e.target.value.toUpperCase())}
          placeholder="Код"
          className="flex-1 rounded-xl border border-[var(--input-border)] bg-white px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
        <button
          type="submit"
          disabled={loading || shortCode.length < 4}
          className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-medium text-[var(--accent-foreground)] disabled:opacity-50"
        >
          {loading ? "…" : "Добавить"}
        </button>
      </div>
      {message && (
        <p
          className={`mt-2 text-xs ${message.includes("Ошиб") || message.includes("Только") || message.includes("не найден") || message.includes("Уже") ? "text-red-600" : "text-[var(--muted)]"}`}
          role="status"
        >
          {message}
        </p>
      )}
    </form>
  );
}
