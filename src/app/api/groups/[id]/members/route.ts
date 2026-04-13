import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { groupMembers, users } from "@/db/schema";
import { isValidPhone, normalizePhone } from "@/lib/phone";

const bodySchema = z.object({
  phone: z.string().min(5).max(32),
});

type Ctx = { params: Promise<{ id: string }> };

/** Добавление участника по номеру телефона (только admin). */
export async function POST(request: Request, context: Ctx) {
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
  if (!membership || membership.role !== "admin") {
    return NextResponse.json({ error: "Только админ может добавлять" }, { status: 403 });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const phone = normalizePhone(parsed.data.phone);
  if (!isValidPhone(phone)) {
    return NextResponse.json({ error: "Некорректный номер телефона" }, { status: 400 });
  }
  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.phone} = ${phone}`)
    .limit(1);
  if (!target) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }
  if (target.id === uid) {
    return NextResponse.json({ error: "Вы уже в группе" }, { status: 400 });
  }
  try {
    await db.insert(groupMembers).values({
      groupId,
      userId: target.id,
      role: "member",
    });
  } catch {
    return NextResponse.json(
      { error: "Уже в группе или ошибка" },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true, userId: target.id });
}
