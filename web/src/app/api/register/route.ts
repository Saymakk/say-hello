import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { randomShortCode } from "@/lib/short-code";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Пароль не короче 8 символов"),
});

/** Регистрация: создаёт пользователя с уникальным short_code (повтор при коллизии). */
export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const email = parsed.data.email.toLowerCase().trim();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) {
    return NextResponse.json(
      { error: "Этот email уже зарегистрирован" },
      { status: 409 }
    );
  }
  const passwordHash = await hash(parsed.data.password, 12);
  for (let attempt = 0; attempt < 8; attempt++) {
    const shortCode = randomShortCode(8);
    try {
      const [inserted] = await db
        .insert(users)
        .values({ email, passwordHash, shortCode })
        .returning({ id: users.id, shortCode: users.shortCode });
      return NextResponse.json({
        ok: true,
        userId: inserted.id,
        shortCode: inserted.shortCode,
      });
    } catch {
      /* уникальный индекс short_code — пробуем другой код */
    }
  }
  return NextResponse.json(
    { error: "Не удалось выделить код, попробуйте снова" },
    { status: 503 }
  );
}
