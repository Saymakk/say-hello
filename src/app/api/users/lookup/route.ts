import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { isValidPhone, normalizePhone } from "@/lib/phone";

/**
 * Поиск пользователя по номеру телефона (digits-only).
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const phoneRaw = searchParams.get("phone")?.trim() ?? "";
  const phone = normalizePhone(phoneRaw);
  if (!isValidPhone(phone)) {
    return NextResponse.json({ error: "Укажите номер телефона" }, { status: 400 });
  }
  const [row] = await db
    .select({
      id: users.id,
      phone: users.phone,
      shortCode: users.shortCode,
      displayName: users.displayName,
    })
    .from(users)
    .where(sql`${users.phone} = ${phone}`)
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }
  if (row.id === session.user.id) {
    return NextResponse.json({ error: "Это ваш код" }, { status: 400 });
  }
  return NextResponse.json(row);
}
