import Link from "next/link";

export default function DmNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-12 text-center">
      <p className="text-[15px] text-[var(--tg-text-secondary)]">Чат не найден</p>
      <Link href="/chats" className="text-[14px] font-medium text-[var(--tg-accent)] hover:underline">
        К списку чатов
      </Link>
    </div>
  );
}
