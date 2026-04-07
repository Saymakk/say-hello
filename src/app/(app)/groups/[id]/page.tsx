import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { AddMemberForm } from "@/components/AddMemberForm";
import { GroupChatPanel } from "@/components/chat/GroupChatPanel";
import { MainHeader } from "@/components/telegram/MainHeader";
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
      <MainHeader
        title={g.name}
        subtitle={
          membership.role === "admin"
            ? "Вы — администратор"
            : "Вы — участник"
        }
      />
      <div className="tg-scroll flex-1 overflow-y-auto px-4 py-4">
        <Link
          href="/groups"
          className="mb-4 inline-block text-[14px] text-[var(--tg-accent)] hover:underline"
        >
          ← Все группы
        </Link>
        {membership.role === "admin" && <AddMemberForm groupId={groupId} />}
        <div className="mt-6">
          <GroupChatPanel groupId={groupId} />
        </div>
        <section className="mt-8">
          <h2 className="mb-2 text-[13px] font-medium uppercase tracking-wide text-[var(--tg-text-secondary)]">
            Участники
          </h2>
          <ul className="rounded-xl border border-[var(--tg-border)]">
            {members.map((m) => (
              <li
                key={m.userId}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--tg-border)] px-3 py-3 text-[14px] last:border-0"
              >
                <span className="font-mono text-[13px]">{m.shortCode}</span>
                <span className="text-right text-[13px] text-[var(--tg-text-secondary)]">
                  {m.displayName ?? "—"} · {m.role === "admin" ? "админ" : "участник"}
                </span>
                {m.userId !== uid && (
                  <Link
                    href={`/chats/dm/${m.userId}`}
                    className="w-full text-[13px] text-[var(--tg-accent)] hover:underline sm:w-auto"
                  >
                    Личный чат →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
