import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

type Ctx = { params: Promise<{ id: string }> };

/** Публичные поля собеседника для шапки чата (только для залогиненных). */
export async function GET(_request: Request, context: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const { id } = await context.params;
  if (id === session.user.id) {
    return NextResponse.json({ error: "Это вы" }, { status: 400 });
  }
  const [row] = await db
    .select({
      id: users.id,
      shortCode: users.shortCode,
      displayName: users.displayName,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }
  return NextResponse.json(row);
}
