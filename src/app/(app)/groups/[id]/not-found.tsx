import Link from "next/link";
import { MainHeader } from "@/components/telegram/MainHeader";

export default function GroupNotFound() {
  return (
    <>
      <MainHeader title="Группа" />
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
        <p className="text-[15px] text-[var(--tg-text-secondary)]">
          Группа не найдена или нет доступа
        </p>
        <Link
          href="/chats"
          className="mt-4 text-[14px] font-medium text-[var(--tg-accent)] hover:underline"
        >
          К чатам
        </Link>
      </div>
    </>
  );
}
