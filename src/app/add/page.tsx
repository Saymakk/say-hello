import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { NavBar } from "@/components/NavBar";
import { AddByCodeClient } from "@/components/AddByCodeClient";

type Props = { searchParams: Promise<{ c?: string }> };

/** Страница из QR: ?c=КОД — дальше пользователь ищет человека и идёт в группы. */
export default async function AddPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const { c } = await searchParams;
  const preset = c?.trim().toUpperCase() ?? "";

  return (
    <>
      <NavBar />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-10">
        <h1 className="text-xl font-semibold text-[var(--foreground)]">
          Найти по коду
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Введите короткий код человека. Email и телефон не показываются — только
          публичный ник, если он его указал.
        </p>
        <AddByCodeClient initialCode={preset} />
        <p className="mt-8 text-center text-sm text-[var(--muted)]">
          Чтобы пригласить в группу, откройте{" "}
          <Link href="/groups" className="underline">
            Группы
          </Link>{" "}
          → группа → добавить участника.
        </p>
      </main>
    </>
  );
}
