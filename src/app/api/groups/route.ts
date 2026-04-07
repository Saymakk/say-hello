import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { groupMembers, groups } from "@/db/schema";

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
  return NextResponse.json(rows);
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
