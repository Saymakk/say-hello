import Link from "next/link";
import { NavBar } from "@/components/NavBar";

export default function GroupNotFound() {
  return (
    <>
      <NavBar />
      <main className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <p className="text-[var(--muted)]">Группа не найдена или нет доступа</p>
        <Link
          href="/groups"
          className="mt-4 text-sm font-medium text-[var(--foreground)] underline"
        >
          К списку групп
        </Link>
      </main>
    </>
  );
}
