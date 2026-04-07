import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { groupMembers, groups, users } from "@/db/schema";

type Ctx = { params: Promise<{ id: string }> };

/** Детали группы и участники — только для членов группы. */
export async function GET(_request: Request, context: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const { id: groupId } = await context.params;
  const uid = session.user.id;
  const [membership] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, uid))
    )
    .limit(1);
  if (!membership) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }
  const [g] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);
  if (!g) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }
  const members = await db
    .select({
      userId: groupMembers.userId,
      role: groupMembers.role,
      joinedAt: groupMembers.joinedAt,
      shortCode: users.shortCode,
      displayName: users.displayName,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.groupId, groupId));
  return NextResponse.json({
    group: g,
    myRole: membership.role,
    members,
  });
}

/** Любой администратор группы может удалить её полностью (сообщения и участники — каскадом). */
export async function DELETE(_request: Request, context: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const { id: groupId } = await context.params;
  const uid = session.user.id;
  const [membership] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, uid))
    )
    .limit(1);
  if (!membership) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }
  if (membership.role !== "admin") {
    return NextResponse.json(
      { error: "Только администратор может удалить чат" },
      { status: 403 }
    );
  }
  await db.delete(groups).where(eq(groups.id, groupId));
  return NextResponse.json({ ok: true });
}
