"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  decryptDumpObject,
  isEncryptedDumpEnvelope,
} from "@/lib/crypto/dump-encrypt";
import { importLocalChatDump } from "@/lib/chat/local-db";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/chats";
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [dumpFile, setDumpFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      phone,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Неверный номер телефона или пароль");
      return;
    }
    try {
      if (dumpFile) {
        const text = await dumpFile.text();
        const raw = JSON.parse(text) as unknown;
        let data: unknown = raw;
        if (isEncryptedDumpEnvelope(raw)) {
          const pw = window.prompt("Пароль от дампа:");
          if (pw) data = await decryptDumpObject(raw, pw);
        }
        await importLocalChatDump(data, "merge");
      }
    } catch {
      setError("Вход выполнен, но импорт дампа не удался");
    }
    router.push(callbackUrl);
    router.refresh();
  }

  async function onPasskeyLogin() {
    setError(null);
    const ph = phone.trim();
    if (!ph) {
      setError("Введите номер телефона — по нему подбирается ключ на устройстве");
      return;
    }
    setBioLoading(true);
    try {
      const optRes = await fetch("/api/webauthn/login/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: ph }),
      });
      if (!optRes.ok) {
        const e = await optRes.json().catch(() => ({}));
        setError(typeof e.error === "string" ? e.error : "Не удалось начать вход по ключу");
        setBioLoading(false);
        return;
      }
      const options = await optRes.json();
      const assertion = await startAuthentication(options);
      const verRes = await fetch("/api/webauthn/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assertion),
      });
      if (!verRes.ok) {
        const e = await verRes.json().catch(() => ({}));
        setError(typeof e.error === "string" ? e.error : "Проверка ключа не прошла");
        setBioLoading(false);
        return;
      }
      const { passkeyCode } = (await verRes.json()) as { passkeyCode?: string };
      if (!passkeyCode) {
        setError("Сервер не вернул код сессии");
        setBioLoading(false);
        return;
      }
      const res = await signIn("credentials", {
        passkeyCode,
        redirect: false,
      });
      setBioLoading(false);
      if (res?.error) {
        setError("Не удалось завершить вход");
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      setBioLoading(false);
      setError(
        err instanceof Error
          ? err.message
          : "Биометрия недоступна или операция отменена"
      );
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-xl border border-[var(--tg-border)] bg-[var(--tg-sidebar)] p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-[var(--tg-text)]">Вход</h1>
        <p className="mt-1 text-[14px] text-[var(--tg-text-secondary)]">Телефон и пароль</p>
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-[14px]">
            <span className="text-[var(--tg-text-secondary)]">Телефон</span>
            <input
              type="tel"
              required
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-lg border border-[var(--tg-border)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--tg-accent)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-[14px]">
            <span className="text-[var(--tg-text-secondary)]">Пароль</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-[var(--tg-border)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--tg-accent)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-[14px]">
            <span className="text-[var(--tg-text-secondary)]">
              Дамп переписок (необязательно)
            </span>
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => setDumpFile(e.target.files?.[0] ?? null)}
              className="rounded-lg border border-[var(--tg-border)] bg-white px-3 py-2 text-[13px] outline-none"
            />
          </label>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || bioLoading}
            className="mt-2 rounded-lg bg-[var(--tg-accent)] py-3 text-[14px] font-medium text-white disabled:opacity-50"
          >
            {loading ? "Входим…" : "Войти"}
          </button>
          <button
            type="button"
            disabled={loading || bioLoading}
            onClick={() => void onPasskeyLogin()}
            className="rounded-lg border border-[var(--tg-border)] py-3 text-[14px] font-medium text-[var(--tg-text)] disabled:opacity-50"
          >
            {bioLoading ? "Ключ…" : "Face ID / отпечаток"}
          </button>
        </form>
        <p className="mt-6 text-center text-[14px] text-[var(--tg-text-secondary)]">
          Нет аккаунта?{" "}
          <Link href="/register" className="font-medium text-[var(--tg-accent)] hover:underline">
            Регистрация
          </Link>
        </p>
      </div>
    </div>
  );
}
