import Link from "next/link";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { NavBar } from "@/components/NavBar";
import { CreateGroupForm } from "@/components/CreateGroupForm";
import { db } from "@/db";
import { groupMembers, groups } from "@/db/schema";

export default async function GroupsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const uid = session.user.id;
  const list = await db
    .select({
      id: groups.id,
      name: groups.name,
      createdAt: groups.createdAt,
      role: groupMembers.role,
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(eq(groupMembers.userId, uid));

  return (
    <>
      <NavBar />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-10">
        <h1 className="text-xl font-semibold text-[var(--foreground)]">Группы</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Создайте группу и добавляйте людей по короткому коду.
        </p>
        <CreateGroupForm />
        <ul className="mt-8 flex flex-col gap-2">
          {list.length === 0 && (
            <li className="rounded-xl bg-[var(--card)] px-4 py-6 text-center text-sm text-[var(--muted)] ring-1 ring-[var(--ring)]">
              Пока нет групп
            </li>
          )}
          {list.map((g) => (
            <li key={g.id}>
              <Link
                href={`/groups/${g.id}`}
                className="flex items-center justify-between rounded-xl bg-[var(--card)] px-4 py-3 shadow-sm ring-1 ring-[var(--ring)] transition hover:ring-[var(--accent)]"
              >
                <span className="font-medium text-[var(--foreground)]">{g.name}</span>
                <span className="text-xs text-[var(--muted)]">
                  {g.role === "admin" ? "админ" : "участник"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
