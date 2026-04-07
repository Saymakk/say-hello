import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * Разрешение short_code → публичные поля (только для залогиненных, чтобы усложнить перебор).
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim().toUpperCase();
  if (!code || code.length < 4) {
    return NextResponse.json({ error: "Укажите код" }, { status: 400 });
  }
  const [row] = await db
    .select({
      id: users.id,
      shortCode: users.shortCode,
      displayName: users.displayName,
    })
    .from(users)
    .where(sql`upper(${users.shortCode}) = ${code}`)
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }
  if (row.id === session.user.id) {
    return NextResponse.json({ error: "Это ваш код" }, { status: 400 });
  }
  return NextResponse.json(row);
}
