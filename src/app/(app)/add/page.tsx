import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AddByCodeClient } from "@/components/AddByCodeClient";
import { MainHeader } from "@/components/telegram/MainHeader";

type Props = { searchParams: Promise<{ c?: string }> };

export default async function AddPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const { c } = await searchParams;
  const preset = c?.trim().toUpperCase() ?? "";

  return (
    <>
      <MainHeader title="Контакты" subtitle="Поиск по коду" />
      <div className="tg-scroll flex-1 overflow-y-auto px-4 py-4">
        <p className="mb-4 text-[14px] text-[var(--tg-text-secondary)]">
          Введите короткий код человека. Email и телефон не показываются — только публичный ник,
          если он его указал.
        </p>
        <AddByCodeClient initialCode={preset} />
        <p className="mt-8 text-center text-[13px] text-[var(--tg-text-secondary)]">
          Чтобы пригласить в группу:{" "}
          <Link href="/groups" className="text-[var(--tg-accent)] hover:underline">
            Группы
          </Link>{" "}
          → группа → добавить участника.
        </p>
      </div>
    </>
  );
}
