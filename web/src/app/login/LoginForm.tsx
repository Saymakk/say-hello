"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Неверный email или пароль");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl bg-[var(--card)] p-8 shadow-sm ring-1 ring-[var(--ring)]">
        <h1 className="text-xl font-semibold text-[var(--foreground)]">Вход</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Почта и пароль</p>
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-[var(--input-border)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Пароль</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-xl border border-[var(--input-border)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--accent)]"
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
            className="mt-2 rounded-full bg-[var(--accent)] py-3 text-sm font-medium text-[var(--accent-foreground)] disabled:opacity-50"
          >
            {loading ? "Входим…" : "Войти"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          Нет аккаунта?{" "}
          <Link href="/register" className="font-medium text-[var(--foreground)] underline">
            Регистрация
          </Link>
        </p>
      </div>
    </div>
  );
}
