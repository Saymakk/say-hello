"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { generateRandomNick } from "@/lib/nick-generator";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type Props = {
  initialDisplayName: string | null;
  /** Вызывается после успешного сохранения (например, обновить данные в модалке). */
  onSaved?: () => void;
};

/** Опциональный ник — отправляется только если пользователь сам заполнит. */
export function ProfileNickForm({ initialDisplayName, onSaved }: Props) {
  const router = useRouter();
  const { locale } = useLocale();
  const [value, setValue] = useState(initialDisplayName ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setLoading(true);
    const res = await fetch("/api/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: value.trim() || null }),
    });
    setLoading(false);
    if (!res.ok) {
      setStatus("Не удалось сохранить");
      return;
    }
    setStatus("Сохранено");
    onSaved?.();
    router.refresh();
  }

  return (
    <form
      onSubmit={save}
      className="mt-6 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-sidebar)] p-5"
    >
      <h2 className="text-[14px] font-medium text-[var(--tg-text)]">
        Как вас показывать другим
      </h2>
      <p className="mt-1 text-[12px] text-[var(--tg-text-secondary)]">
        Необязательно. Можно оставить пустым для большей анонимности.
      </p>
      <input
        type="text"
        maxLength={64}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ник или имя"
        className="mt-3 w-full rounded-lg border border-[var(--tg-border)] bg-white px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-[var(--tg-accent)]"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setValue(generateRandomNick(locale))}
          className="rounded-lg border border-[var(--tg-border)] px-4 py-2 text-[13px] font-medium text-[var(--tg-text)] hover:bg-[var(--tg-hover)]"
        >
          Сгенерировать ник
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[var(--tg-accent)] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
        >
          {loading ? "…" : "Сохранить"}
        </button>
        {status && (
          <span className="text-[12px] text-[var(--tg-text-secondary)]">{status}</span>
        )}
      </div>
    </form>
  );
}
