import { compare, hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

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
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Текущий пароль и новый (от 8 символов) обязательны" },
      { status: 400 }
    );
  }
  const [row] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }
  const ok = await compare(parsed.data.currentPassword, row.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Неверный текущий пароль" }, { status: 400 });
  }
  const newHash = await hash(parsed.data.newPassword, 10);
  await db
    .update(users)
    .set({ passwordHash: newHash })
    .where(eq(users.id, session.user.id));
  return NextResponse.json({ ok: true });
}
