import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { groupMembers } from "@/db/schema";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Тексты групповых сообщений не хранятся в БД — только зашифрованные пакеты в signal_packets
 * (см. клиент group-signal-sync). Список сообщений — из IndexedDB на устройстве.
 */
export async function GET(_request: Request, context: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const { id: groupId } = await context.params;
  const uid = session.user.id;
  const [m] = await db
    .select()
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, uid))
    )
    .limit(1);
  if (!m) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }
  return NextResponse.json([]);
}

export async function POST(_request: Request, context: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const { id: groupId } = await context.params;
  const [m] = await db
    .select()
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, session.user.id))
    )
    .limit(1);
  if (!m) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }
  return NextResponse.json(
    {
      error:
        "Сообщения группы передаются только через зашифрованные сигналы; обновите приложение.",
    },
    { status: 410 }
  );
}
