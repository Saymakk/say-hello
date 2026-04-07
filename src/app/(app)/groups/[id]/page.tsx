import { and, eq } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { GroupDetailClient } from "@/components/groups/GroupDetailClient";
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <GroupDetailClient
        groupId={groupId}
        groupName={g.name}
        isAdmin={membership.role === "admin"}
        currentUserId={uid}
        members={members}
      />
    </div>
  );
}
