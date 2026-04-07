"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { notifyInboxAndSidebarRefresh } from "@/lib/chat/inbox-events";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CreateGroupModal({ open, onClose }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setError(null);
      setName("");
    }
  }, [open]);

  if (!open) return null;

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
    onClose();
    notifyInboxAndSidebarRefresh();
    router.push(`/groups/${data.id}`);
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-group-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={createGroup}
        className="w-full max-w-md rounded-2xl border border-[var(--tg-border)] bg-[var(--tg-main)] p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="create-group-title" className="text-[15px] font-semibold text-[var(--tg-text)]">
          Новая группа
        </h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Название"
          required
          maxLength={80}
          autoFocus
          className="mt-3 w-full rounded-lg border border-[var(--tg-border)] bg-white px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-[var(--tg-accent)]"
        />
        {error && (
          <p className="mt-2 text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-[14px] text-[var(--tg-text-secondary)] hover:bg-[var(--tg-hover)]"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="rounded-lg bg-[var(--tg-accent)] px-5 py-2 text-[14px] font-medium text-white disabled:opacity-50"
          >
            {loading ? "…" : "Создать"}
          </button>
        </div>
      </form>
    </div>
  );
}
