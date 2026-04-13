"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  decryptDumpObject,
  isEncryptedDumpEnvelope,
} from "@/lib/crypto/dump-encrypt";
import { importLocalChatDump } from "@/lib/chat/local-db";

export default function RegisterPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [dumpFile, setDumpFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function importDumpIfSelected() {
    if (!dumpFile) return;
    const text = await dumpFile.text();
    const raw = JSON.parse(text) as unknown;
    let data: unknown = raw;
    if (isEncryptedDumpEnvelope(raw)) {
      const pw = window.prompt("Пароль от дампа:");
      if (!pw) return;
      data = await decryptDumpObject(raw, pw);
    }
    await importLocalChatDump(data, "merge");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(
        typeof data.error === "string"
          ? data.error
          : "Не удалось зарегистрироваться"
      );
      return;
    }
    const sign = await signIn("credentials", {
      phone,
      password,
      redirect: false,
    });
    if (sign?.error) {
      setError("Аккаунт создан, но вход не удался — попробуйте войти вручную");
      return;
    }
    try {
      await importDumpIfSelected();
    } catch {
      setError("Вход выполнен, но не удалось импортировать дамп");
    }
    router.push("/chats");
    router.refresh();
  }

  return (
    <div className="flex min-h-[100dvh] flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-xl border border-[var(--tg-border)] bg-[var(--tg-sidebar)] p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-[var(--tg-text)]">
          Регистрация
        </h1>
        <p className="mt-1 text-[14px] text-[var(--tg-text-secondary)]">
          Минимум данных: номер телефона, пароль и автоматический короткий код
        </p>
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
            <span className="text-[var(--tg-text-secondary)]">Пароль (от 8 символов)</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
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
            disabled={loading}
            className="mt-2 rounded-lg bg-[var(--tg-accent)] py-3 text-[14px] font-medium text-white disabled:opacity-50"
          >
            {loading ? "Создаём…" : "Создать аккаунт"}
          </button>
        </form>
        <p className="mt-6 text-center text-[14px] text-[var(--tg-text-secondary)]">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="font-medium text-[var(--tg-accent)] hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
