"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateGroupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Ошибка");
      return;
    }
    setName("");
    router.push(`/groups/${data.id}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={createGroup}
      className="rounded-xl border border-[var(--tg-border)] bg-[var(--tg-sidebar)] p-4"
    >
      <h2 className="text-[14px] font-medium text-[var(--tg-text)]">Новая группа</h2>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Название"
          required
          maxLength={80}
          className="flex-1 rounded-lg border border-[var(--tg-border)] bg-white px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-[var(--tg-accent)]"
        />
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="rounded-lg bg-[var(--tg-accent)] px-5 py-2 text-[14px] font-medium text-white disabled:opacity-50"
        >
          {loading ? "…" : "Создать"}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
