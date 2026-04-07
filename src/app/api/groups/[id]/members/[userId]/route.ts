import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { groupMembers } from "@/db/schema";

type Ctx = { params: Promise<{ id: string; userId: string }> };

/** Удаление участника (админ) или выход из группы (сам пользователь). */
export async function DELETE(_request: Request, context: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const { id: groupId, userId: targetUserId } = await context.params;
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

  const [targetMembership] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, targetUserId)
      )
    )
    .limit(1);

  if (!targetMembership) {
    return NextResponse.json({ error: "Участник не найден" }, { status: 404 });
  }

  const admins = await db
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.role, "admin"))
    );

  const adminCount = admins.length;

  if (targetMembership.role === "admin" && adminCount <= 1) {
    return NextResponse.json(
      {
        error:
          targetUserId === uid
            ? "Вы единственный администратор. Удалите группу или сначала назначьте другого администратора."
            : "Нельзя удалить последнего администратора.",
      },
      { status: 400 }
    );
  }

  if (targetUserId === uid) {
    await db
      .delete(groupMembers)
      .where(
        and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, uid))
      );
    return NextResponse.json({ ok: true, left: true });
  }

  if (membership.role !== "admin") {
    return NextResponse.json(
      { error: "Только администратор может удалять участников" },
      { status: 403 }
    );
  }

  await db
    .delete(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, targetUserId)
      )
    );

  return NextResponse.json({ ok: true });
}
