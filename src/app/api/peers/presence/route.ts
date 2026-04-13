import { inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { isValidPhone, normalizePhone } from "@/lib/phone";

/** Считаем «онлайн», если last_seen за последние 2 минуты. */
const ONLINE_MS = 120_000;

/**
 * GET ?ids=id1,id2,... — онлайн-статус для списка собеседников (личные чаты).
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("ids") ?? "";
  const ids = raw
    .split(",")
    .map((s) => normalizePhone(s.trim()))
    .filter((s) => isValidPhone(s))
    .slice(0, 50);

  if (ids.length === 0) {
    return NextResponse.json({ online: {} as Record<string, boolean> });
  }

  const rows = await db
    .select({ id: users.id, lastSeenAt: users.lastSeenAt })
    .from(users)
    .where(inArray(users.id, ids));

  const now = Date.now();
  const online: Record<string, boolean> = {};
  for (const id of ids) {
    online[id] = false;
  }
  for (const r of rows) {
    if (!r.lastSeenAt) continue;
    online[r.id] = now - r.lastSeenAt.getTime() < ONLINE_MS;
  }

  return NextResponse.json({ online });
}
