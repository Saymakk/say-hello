import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { dmRequests, users } from "@/db/schema";

/** Входящие запросы на переписку (ожидают решения). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const me = session.user.id;

  const rows = await db
    .select({
      id: dmRequests.id,
      firstMessagePreview: dmRequests.firstMessagePreview,
      createdAt: dmRequests.createdAt,
      fromUserId: dmRequests.fromUserId,
      shortCode: users.shortCode,
      displayName: users.displayName,
    })
    .from(dmRequests)
    .innerJoin(users, eq(dmRequests.fromUserId, users.id))
    .where(
      and(eq(dmRequests.toUserId, me), eq(dmRequests.status, "pending"))
    );

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      firstMessagePreview: r.firstMessagePreview,
      from: {
        id: r.fromUserId,
        shortCode: r.shortCode,
        displayName: r.displayName,
      },
    }))
  );
}
