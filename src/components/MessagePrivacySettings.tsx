"use client";

import { useEffect, useState } from "react";
import { useChatObfuscation } from "@/components/ChatObfuscationProvider";

type Props = {
  initialWindowMinutes: number;
  variant?: "page" | "modal";
};

export function MessagePrivacySettings({
  initialWindowMinutes,
  variant = "page",
}: Props) {
  const {
    obfuscateEnabled,
    setObfuscateEnabled,
    unlockSuccessCount,
    tryUnlockWithPassword,
  } = useChatObfuscation();
  const [minutes, setMinutes] = useState(String(initialWindowMinutes));

  useEffect(() => {
    setMinutes(String(initialWindowMinutes));
  }, [initialWindowMinutes]);
  const [pwd, setPwd] = useState("");
  const [unlockMsg, setUnlockMsg] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function saveWindow() {
    const n = parseInt(minutes, 10);
    if (!Number.isFinite(n) || n < 1 || n > 10080) {
      setSaveStatus("От 1 до 10080 минут (неделя)");
      return;
    }
    setSaveStatus(null);
    setLoading(true);
    const res = await fetch("/api/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ messageEditWindowMinutes: n }),
    });
    setLoading(false);
    if (!res.ok) {
      setSaveStatus("Не удалось сохранить");
      return;
    }
    setSaveStatus("Сохранено");
  }

  async function tryUnlock(e: React.FormEvent) {
    e.preventDefault();
    setUnlockMsg(null);
    if (!pwd.trim()) return;
    const r = await tryUnlockWithPassword(pwd);
    setPwd("");
    if (!r.ok) {
      setUnlockMsg("Неверный пароль");
      return;
    }
    if (r.restored) {
      setUnlockMsg("Отображение восстановлено.");
      return;
    }
    const left = r.successStreak !== undefined ? 3 - r.successStreak : 0;
    setUnlockMsg(`Верно. Осталось успешных вводов: ${Math.max(0, left)}.`);
  }

  const outer = variant === "modal" ? "mt-0 space-y-3" : "mt-3 space-y-3";

  return (
    <div className={outer}>
      <div className="rounded-lg border border-[var(--tg-border)] bg-[var(--tg-sidebar)] p-3">
        <h2 className="text-[14px] font-medium text-[var(--tg-text)]">
          Редактирование и удаление сообщений
        </h2>
        <p className="mt-1 text-[12px] text-[var(--tg-text-secondary)]">
          Сколько минут после отправки можно править или удалить своё сообщение (личка и группы).
          По умолчанию 30.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-[12px] text-[var(--tg-text-secondary)]">
            Минуты
            <input
              type="number"
              min={1}
              max={10080}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="w-28 rounded-lg border border-[var(--tg-border)] bg-white px-2 py-1.5 text-[14px]"
            />
          </label>
          <button
            type="button"
            disabled={loading}
            onClick={() => void saveWindow()}
            className="rounded-lg bg-[var(--tg-accent)] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
          >
            {loading ? "…" : "Сохранить"}
          </button>
          {saveStatus && (
            <span className="text-[12px] text-[var(--tg-text-secondary)]">{saveStatus}</span>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-[var(--tg-border)] bg-[var(--tg-sidebar)] p-3">
        <h2 className="text-[14px] font-medium text-[var(--tg-text)]">
          Скрыть текст в чатах на экране
        </h2>
        <p className="mt-1 text-[12px] leading-snug text-[var(--tg-text-secondary)]">
          Только отображение: переписка в памяти и базе не меняется. Фото дополнительно размываются.
          Чтобы вернуть читаемый текст, три раза подряд введите пароль ниже.
        </p>
        {!obfuscateEnabled ? (
          <button
            type="button"
            onClick={() => setObfuscateEnabled(true)}
            className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-[13px] font-medium text-amber-900"
          >
            Скрыть текст сейчас
          </button>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-[12px] font-medium text-amber-800">Режим скрытия включён</p>
            <form onSubmit={tryUnlock} className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-[12px] text-[var(--tg-text-secondary)]">
                Пароль аккаунта (нужно 3 успешных ввода подряд)
                <input
                  type="password"
                  autoComplete="current-password"
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  className="rounded-lg border border-[var(--tg-border)] bg-white px-2 py-1.5 text-[14px]"
                />
              </label>
              <button
                type="submit"
                className="rounded-lg bg-[var(--tg-accent)] px-4 py-2 text-[13px] font-medium text-white"
              >
                Проверить
              </button>
            </form>
            {unlockMsg && (
              <p className="text-[12px] text-[var(--tg-text-secondary)]">{unlockMsg}</p>
            )}
            <p className="text-[11px] text-[var(--tg-text-secondary)]">
              Успешных вводов в этой сессии: {unlockSuccessCount} / 3
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
