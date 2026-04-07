import { and, desc, eq, gt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { groupMembers, groupMessages, users } from "@/db/schema";

const postSchema = z.object({
  text: z.string().min(1).max(8000),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Ctx) {
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
  const { searchParams } = new URL(request.url);
  const sinceParam = searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : null;
  const rows = await db
    .select({
      id: groupMessages.id,
      body: groupMessages.body,
      createdAt: groupMessages.createdAt,
      userId: groupMessages.userId,
      shortCode: users.shortCode,
      displayName: users.displayName,
    })
    .from(groupMessages)
    .innerJoin(users, eq(groupMessages.userId, users.id))
    .where(
      since && !Number.isNaN(since.getTime())
        ? and(
            eq(groupMessages.groupId, groupId),
            gt(groupMessages.createdAt, since)
          )
        : eq(groupMessages.groupId, groupId)
    )
    .orderBy(desc(groupMessages.createdAt))
    .limit(100);
  rows.reverse();
  return NextResponse.json(rows);
}

export async function POST(request: Request, context: Ctx) {
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
  const [row] = await db
    .insert(groupMessages)
    .values({
      groupId,
      userId: uid,
      body: parsed.data.text.trim(),
    })
    .returning({
      id: groupMessages.id,
      body: groupMessages.body,
      createdAt: groupMessages.createdAt,
    });
  return NextResponse.json(row);
}
