import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { NavBar } from "@/components/NavBar";
import { AddMemberForm } from "@/components/AddMemberForm";
import { db } from "@/db";
import { groupMembers, groups, users } from "@/db/schema";

type Props = { params: Promise<{ id: string }> };

export default async function GroupDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const { id: groupId } = await params;
  const uid = session.user.id;
  const [membership] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, uid))
    )
    .limit(1);
  if (!membership) {
    notFound();
  }
  const [g] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);
  if (!g) {
    notFound();
  }
  const members = await db
    .select({
      userId: groupMembers.userId,
      role: groupMembers.role,
      shortCode: users.shortCode,
      displayName: users.displayName,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.groupId, groupId));

  return (
    <>
      <NavBar />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-10">
        <Link
          href="/groups"
          className="text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
        >
          ← Все группы
        </Link>
        <h1 className="mt-4 text-xl font-semibold text-[var(--foreground)]">
          {g.name}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Ваша роль: {membership.role === "admin" ? "администратор" : "участник"}
        </p>
        {membership.role === "admin" && <AddMemberForm groupId={groupId} />}
        <section className="mt-8">
          <h2 className="text-sm font-medium text-[var(--foreground)]">Участники</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {members.map((m) => (
              <li
                key={m.userId}
                className="flex items-center justify-between rounded-xl bg-[var(--card)] px-4 py-3 text-sm ring-1 ring-[var(--ring)]"
              >
                <span className="font-mono">{m.shortCode}</span>
                <span className="text-[var(--muted)]">
                  {m.displayName ?? "—"} · {m.role === "admin" ? "админ" : "участник"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
