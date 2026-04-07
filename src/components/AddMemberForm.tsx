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
      className="rounded-xl border border-[var(--tg-border)] bg-[var(--tg-sidebar)] p-4"
    >
      <h2 className="text-[14px] font-medium text-[var(--tg-text)]">
        Добавить по коду
      </h2>
      <p className="mt-1 text-[12px] text-[var(--tg-text-secondary)]">
        Введите короткий код человека — он получит роль участника.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={shortCode}
          onChange={(e) => setShortCode(e.target.value.toUpperCase())}
          placeholder="Код"
          className="flex-1 rounded-lg border border-[var(--tg-border)] bg-white px-3 py-2 font-mono text-[14px] outline-none focus:ring-2 focus:ring-[var(--tg-accent)]"
        />
        <button
          type="submit"
          disabled={loading || shortCode.length < 4}
          className="rounded-lg bg-[var(--tg-accent)] px-5 py-2 text-[14px] font-medium text-white disabled:opacity-50"
        >
          {loading ? "…" : "Добавить"}
        </button>
      </div>
      {message && (
        <p
          className={`mt-2 text-[12px] ${message.includes("Ошиб") || message.includes("Только") || message.includes("не найден") || message.includes("Уже") ? "text-red-600" : "text-[var(--tg-text-secondary)]"}`}
          role="status"
        >
          {message}
        </p>
      )}
    </form>
  );
}
