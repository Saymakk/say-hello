import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

/** Текущий пользователь + short_code для QR и шаринга (без пароля). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      shortCode: users.shortCode,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }
  return NextResponse.json(row);
}
