import Link from "next/link";
import Image from "next/image";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) {
    redirect("/chats");
  }
  return (
    <div className="flex min-h-[100dvh] flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="max-w-md text-center">
        <h1 className="flex items-center justify-center gap-2 text-3xl font-semibold tracking-tight text-[var(--tg-text)]">
          <Image
            src="/icon.png"
            alt="Say Hello"
            width={28}
            height={28}
            priority
          />
          <span>Say Hello</span>
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[var(--tg-text-secondary)]">
          Веб-версия мессенджера: минимум данных на сервере, переписки — только на
          ваших устройствах. Сейчас доступны аккаунт, код и QR для связи и группы.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="rounded-full bg-[var(--tg-accent)] px-8 py-3 text-center text-sm font-medium text-white shadow-sm transition hover:bg-[var(--tg-accent-hover)]"
          >
            Войти
          </Link>
          <Link
            href="/register"
            className="rounded-full border border-[var(--tg-border)] bg-white px-8 py-3 text-center text-sm font-medium text-[var(--tg-text)] shadow-sm transition hover:bg-[var(--tg-hover)]"
          >
            Регистрация
          </Link>
        </div>
      </div>
    </div>
  );
}
