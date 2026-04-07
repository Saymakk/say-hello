"use client";

import { useState } from "react";

export function PasswordChangeForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setLoading(true);
    const res = await fetch("/api/me/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setStatus(typeof data.error === "string" ? data.error : "Ошибка");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setStatus("Пароль обновлён");
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-6 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-sidebar)] p-5"
    >
      <h2 className="text-[14px] font-medium text-[var(--tg-text)]">Смена пароля</h2>
      <label className="mt-3 flex flex-col gap-1 text-[12px] text-[var(--tg-text-secondary)]">
        Текущий пароль
        <input
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="rounded-lg border border-[var(--tg-border)] bg-white px-2 py-1.5 text-[14px]"
        />
      </label>
      <label className="mt-2 flex flex-col gap-1 text-[12px] text-[var(--tg-text-secondary)]">
        Новый пароль (от 8 символов)
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="rounded-lg border border-[var(--tg-border)] bg-white px-2 py-1.5 text-[14px]"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="mt-3 rounded-lg bg-[var(--tg-accent)] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
      >
        {loading ? "…" : "Обновить пароль"}
      </button>
      {status && (
        <p className="mt-2 text-[12px] text-[var(--tg-text-secondary)]">{status}</p>
      )}
    </form>
  );
}
