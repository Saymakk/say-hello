import Link from "next/link";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CreateGroupForm } from "@/components/CreateGroupForm";
import { MainHeader } from "@/components/telegram/MainHeader";
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
      <MainHeader title="Группы" subtitle="Создавайте и добавляйте по коду" />
      <div className="tg-scroll flex-1 overflow-y-auto px-4 py-4">
        <CreateGroupForm />
        <ul className="mt-4 flex flex-col gap-0">
          {list.length === 0 && (
            <li className="rounded-xl border border-dashed border-[var(--tg-border)] px-4 py-8 text-center text-[14px] text-[var(--tg-text-secondary)]">
              Пока нет групп
            </li>
          )}
          {list.map((g) => (
            <li key={g.id} className="border-b border-[var(--tg-border)] last:border-0">
              <Link
                href={`/groups/${g.id}`}
                className="flex items-center justify-between gap-3 py-3.5 transition hover:bg-[var(--tg-hover)]"
              >
                <span className="text-[15px] font-medium text-[var(--tg-text)]">{g.name}</span>
                <span className="shrink-0 text-[13px] text-[var(--tg-text-secondary)]">
                  {g.role === "admin" ? "админ" : "участник"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
