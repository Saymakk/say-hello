import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { groupMembers, groupMessages, users } from "@/db/schema";

const patchSchema = z.object({
  text: z.string().min(1).max(8000),
});

type Ctx = { params: Promise<{ id: string; messageId: string }> };

async function assertMember(groupId: string, userId: string) {
  const [m] = await db
    .select()
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId))
    )
    .limit(1);
  return !!m;
}

async function editWindowMsForUser(userId: string): Promise<number> {
  const [u] = await db
    .select({ minutes: users.messageEditWindowMinutes })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const min = u?.minutes ?? 30;
  return Math.max(1, min) * 60 * 1000;
}

export async function PATCH(request: Request, context: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const { id: groupId, messageId } = await context.params;
  if (!(await assertMember(groupId, session.user.id))) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректный текст" }, { status: 400 });
  }
  const [msg] = await db
    .select()
    .from(groupMessages)
    .where(
      and(eq(groupMessages.id, messageId), eq(groupMessages.groupId, groupId))
    )
    .limit(1);
  if (!msg) {
    return NextResponse.json({ error: "Сообщение не найдено" }, { status: 404 });
  }
  if (msg.userId !== session.user.id) {
    return NextResponse.json({ error: "Только автор может править" }, { status: 403 });
  }
  const windowMs = await editWindowMsForUser(session.user.id);
  if (Date.now() - new Date(msg.createdAt).getTime() > windowMs) {
    return NextResponse.json(
      { error: "Истекло время редактирования в настройках" },
      { status: 400 }
    );
  }
  await db
    .update(groupMessages)
    .set({
      body: parsed.data.text.trim(),
      editedAt: new Date(),
    })
    .where(eq(groupMessages.id, messageId));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const { id: groupId, messageId } = await context.params;
  if (!(await assertMember(groupId, session.user.id))) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }
  const [msg] = await db
    .select()
    .from(groupMessages)
    .where(
      and(eq(groupMessages.id, messageId), eq(groupMessages.groupId, groupId))
    )
    .limit(1);
  if (!msg) {
    return NextResponse.json({ error: "Сообщение не найдено" }, { status: 404 });
  }
  if (msg.userId !== session.user.id) {
    return NextResponse.json({ error: "Только автор может удалить" }, { status: 403 });
  }
  const windowMs = await editWindowMsForUser(session.user.id);
  if (Date.now() - new Date(msg.createdAt).getTime() > windowMs) {
    return NextResponse.json(
      { error: "Истекло время удаления в настройках" },
      { status: 400 }
    );
  }
  await db.delete(groupMessages).where(eq(groupMessages.id, messageId));
  return NextResponse.json({ ok: true });
}
