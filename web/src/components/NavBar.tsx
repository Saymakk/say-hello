"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

export function NavBar() {
  return (
    <header className="border-b border-[var(--ring)] bg-[var(--card)]/80 backdrop-blur-sm">
      <nav className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-[var(--foreground)]"
        >
          Say Hello
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link
            href="/groups"
            className="text-[var(--muted)] transition hover:text-[var(--foreground)]"
          >
            Группы
          </Link>
          <Link
            href="/add"
            className="text-[var(--muted)] transition hover:text-[var(--foreground)]"
          >
            Добавить
          </Link>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-[var(--muted)] transition hover:text-[var(--foreground)]"
          >
            Выйти
          </button>
        </div>
      </nav>
    </header>
  );
}
