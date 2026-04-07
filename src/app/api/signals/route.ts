import { and, eq, gt, inArray, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { groupMembers, signalPackets } from "@/db/schema";

const postSchema = z.object({
  /** Личный сигнал */
  toUserId: z.string().uuid().optional(),
  /** Сигналинг внутри группы (все участники читают опросом) */
  groupId: z.string().uuid().optional(),
  payload: z.string().min(1).max(500_000),
});

/**
 * POST: положить SDP/ICE и т.д. для P2P.
 * GET: забрать пакеты, адресованные мне или моим группам.
 *     Параметр `since` — ISO-время; если не задан, берём последние 2 минуты (для первого опроса).
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const uid = session.user.id;
  const { searchParams } = new URL(request.url);
  const sinceParam = searchParams.get("since");
  const since = sinceParam
    ? new Date(sinceParam)
    : new Date(Date.now() - 2 * 60 * 1000);
  if (Number.isNaN(since.getTime())) {
    return NextResponse.json({ error: "Некорректный since" }, { status: 400 });
  }
  const myGroups = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, uid));
  const groupIds = myGroups.map((g) => g.groupId);
  const conditions = [eq(signalPackets.toUserId, uid)];
  if (groupIds.length > 0) {
    conditions.push(inArray(signalPackets.groupId, groupIds));
  }
  const baseWhere = or(...conditions);
  const whereClause = and(baseWhere, gt(signalPackets.createdAt, since));
  const rows = await db
    .select()
    .from(signalPackets)
    .where(whereClause)
    .limit(100);
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { toUserId, groupId, payload } = parsed.data;
  if (!toUserId && !groupId) {
    return NextResponse.json(
      { error: "Нужен toUserId или groupId" },
      { status: 400 }
    );
  }
  if (toUserId && groupId) {
    return NextResponse.json(
      { error: "Только один из toUserId / groupId" },
      { status: 400 }
    );
  }
  const fromUserId = session.user.id;
  if (groupId) {
    const [m] = await db
      .select()
      .from(groupMembers)
      .where(
        and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, fromUserId))
      )
      .limit(1);
    if (!m) {
      return NextResponse.json({ error: "Нет в этой группе" }, { status: 403 });
    }
  }
  const [row] = await db
    .insert(signalPackets)
    .values({
      fromUserId,
      toUserId: toUserId ?? null,
      groupId: groupId ?? null,
      payload,
    })
    .returning({ id: signalPackets.id });
  return NextResponse.json(row);
}
