import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
          Say Hello
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">
          Веб-версия мессенджера: минимум данных на сервере, переписки — только на
          ваших устройствах (в следующих шагах). Сейчас доступны аккаунт, код и QR
          для связи и группы.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="rounded-full bg-[var(--accent)] px-8 py-3 text-center text-sm font-medium text-[var(--accent-foreground)] shadow-sm transition hover:opacity-90"
          >
            Войти
          </Link>
          <Link
            href="/register"
            className="rounded-full border border-[var(--input-border)] bg-white px-8 py-3 text-center text-sm font-medium text-[var(--foreground)] shadow-sm transition hover:bg-[var(--background)]"
          >
            Регистрация
          </Link>
        </div>
      </div>
    </div>
  );
}
