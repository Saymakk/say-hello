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
      className="mt-6 rounded-2xl bg-[var(--card)] p-5 shadow-sm ring-1 ring-[var(--ring)]"
    >
      <h2 className="text-sm font-medium text-[var(--foreground)]">Новая группа</h2>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Название"
          required
          maxLength={80}
          className="flex-1 rounded-xl border border-[var(--input-border)] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-medium text-[var(--accent-foreground)] disabled:opacity-50"
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
