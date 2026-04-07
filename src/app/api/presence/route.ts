import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

/** Heartbeat: отмечает пользователя как недавно активного (для индикатора онлайн). */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const now = new Date();
  await db
    .update(users)
    .set({ lastSeenAt: now })
    .where(eq(users.id, session.user.id));
  return NextResponse.json({ ok: true, at: now.toISOString() });
}
