import { eq, inArray, max } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { GroupsPageClient } from "@/components/groups/GroupsPageClient";
import { MainHeader } from "@/components/telegram/MainHeader";
import { db } from "@/db";
import { groupMembers, groupMessages, groups } from "@/db/schema";

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

  const ids = list.map((g) => g.id);
  let lastMap = new Map<string, Date | null>();
  if (ids.length > 0) {
    const lasts = await db
      .select({
        groupId: groupMessages.groupId,
        lastAt: max(groupMessages.createdAt),
      })
      .from(groupMessages)
      .where(inArray(groupMessages.groupId, ids))
      .groupBy(groupMessages.groupId);
    lastMap = new Map(lasts.map((x) => [x.groupId, x.lastAt]));
  }

  const serializable = list
    .map((g) => ({
      id: g.id,
      name: g.name,
      role: g.role,
      lastMessageAt: lastMap.get(g.id)?.toISOString() ?? null,
    }))
    .sort((a, b) => {
      const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      if (tb !== ta) return tb - ta;
      return a.name.localeCompare(b.name, "ru");
    });

  return (
    <>
      <MainHeader title="Группы" subtitle="Чат и участники — внутри группы" />
      <GroupsPageClient groups={serializable} />
    </>
  );
}
