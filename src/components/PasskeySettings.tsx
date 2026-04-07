"use client";

import { startRegistration } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  initialPasskeyCount: number;
  variant?: "page" | "modal";
};

export function PasskeySettings({ initialPasskeyCount, variant = "page" }: Props) {
  const router = useRouter();
  const [count, setCount] = useState(initialPasskeyCount);

  useEffect(() => {
    setCount(initialPasskeyCount);
  }, [initialPasskeyCount]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function addPasskey() {
    setStatus(null);
    setBusy(true);
    try {
      const optRes = await fetch("/api/webauthn/register/options", {
        method: "POST",
        credentials: "include",
      });
      if (!optRes.ok) {
        const e = await optRes.json().catch(() => ({}));
        setStatus(typeof e.error === "string" ? e.error : "Не удалось начать регистрацию");
        setBusy(false);
        return;
      }
      const options = await optRes.json();
      const att = await startRegistration(options);
      const verRes = await fetch("/api/webauthn/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(att),
      });
      if (!verRes.ok) {
        const e = await verRes.json().catch(() => ({}));
        setStatus(typeof e.error === "string" ? e.error : "Проверка не прошла");
        setBusy(false);
        return;
      }
      setCount((c) => c + 1);
      setStatus("Ключ добавлен. Теперь можно входить через Face ID или отпечаток.");
      router.refresh();
    } catch (err) {
      setStatus(
        err instanceof Error ? err.message : "Операция отменена или недоступна в этом браузере"
      );
    }
    setBusy(false);
  }

  const shell =
    variant === "modal"
      ? "mt-0 rounded-lg border-0 bg-transparent p-0"
      : "mt-3 rounded-lg border border-[var(--tg-border)] bg-[var(--tg-sidebar)] p-3";

  return (
    <div className={shell}>
      {variant === "page" && (
        <h2 className="text-[14px] font-medium text-[var(--tg-text)]">
          Вход по Face ID / отпечатку
        </h2>
      )}
      <p
        className={`text-[12px] leading-snug text-[var(--tg-text-secondary)] ${variant === "page" ? "mt-1" : "mt-0"}`}
      >
        Работает в поддерживаемых браузерах (Safari, Chrome). На этом устройстве добавьте ключ —
        затем на экране входа можно подтвердить личность без пароля.
      </p>
      <p className="mt-2 text-[12px] text-[var(--tg-text-secondary)]">
        Сохранённых ключей: <span className="font-mono">{count}</span>
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void addPasskey()}
        className="mt-3 rounded-lg bg-[var(--tg-accent)] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
      >
        {busy ? "…" : "Добавить ключ на этом устройстве"}
      </button>
      {status && (
        <p className="mt-2 text-[12px] text-[var(--tg-text-secondary)]">{status}</p>
      )}
    </div>
  );
}
