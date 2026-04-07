import { and, eq, inArray, isNotNull, max } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { groupMembers, groups, signalPackets } from "@/db/schema";

const createSchema = z.object({
  name: z.string().min(1).max(80),
});

/** Список групп, где состоит текущий пользователь. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const uid = session.user.id;
  const rows = await db
    .select({
      id: groups.id,
      name: groups.name,
      createdAt: groups.createdAt,
      role: groupMembers.role,
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(eq(groupMembers.userId, uid));
  const ids = rows.map((r) => r.id);
  let lastMap = new Map<string, Date | null>();
  if (ids.length > 0) {
    const lasts = await db
      .select({
        groupId: signalPackets.groupId,
        lastAt: max(signalPackets.createdAt),
      })
      .from(signalPackets)
      .where(
        and(
          inArray(signalPackets.groupId, ids),
          isNotNull(signalPackets.groupId)
        )
      )
      .groupBy(signalPackets.groupId);
    lastMap = new Map(
      lasts.map((x) => [x.groupId as string, x.lastAt])
    );
  }
  const list = rows
    .map((r) => ({
      ...r,
      lastMessageAt: lastMap.get(r.id)?.toISOString() ?? null,
    }))
    .sort((a, b) => {
      const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      if (tb !== ta) return tb - ta;
      return a.name.localeCompare(b.name, "ru");
    });
  return NextResponse.json(list);
}

/** Создание группы: автор становится admin. */
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
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const uid = session.user.id;
  const [g] = await db
    .insert(groups)
    .values({ name: parsed.data.name.trim(), createdBy: uid })
    .returning();
  if (!g) {
    return NextResponse.json({ error: "Не удалось создать" }, { status: 500 });
  }
  await db.insert(groupMembers).values({
    groupId: g.id,
    userId: uid,
    role: "admin",
  });
  return NextResponse.json(g);
}
