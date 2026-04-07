import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { dmRequests } from "@/db/schema";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const me = session.user.id;
  const { id } = await context.params;

  const [reqRow] = await db
    .select()
    .from(dmRequests)
    .where(
      and(
        eq(dmRequests.id, id),
        eq(dmRequests.toUserId, me),
        eq(dmRequests.status, "pending")
      )
    )
    .limit(1);

  if (!reqRow) {
    return NextResponse.json({ error: "Запрос не найден" }, { status: 404 });
  }

  await db
    .update(dmRequests)
    .set({ status: "declined" })
    .where(eq(dmRequests.id, id));

  return NextResponse.json({ ok: true });
}
