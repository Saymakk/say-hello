import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { randomShortCode } from "@/lib/short-code";
import { isValidPhone, normalizePhone } from "@/lib/phone";

const bodySchema = z.object({
  phone: z.string().min(5),
  password: z.string().min(8, "Пароль не короче 8 символов"),
});

/** Регистрация: user id = phone (digits-only) + пароль + short_code. */
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
  const phone = normalizePhone(parsed.data.phone);
  if (!isValidPhone(phone)) {
    return NextResponse.json(
      { error: "Номер телефона должен содержать 10-15 цифр" },
      { status: 400 }
    );
  }
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);
  if (existing.length > 0) {
    return NextResponse.json(
      { error: "Этот номер уже зарегистрирован" },
      { status: 409 }
    );
  }
  const passwordHash = await hash(parsed.data.password, 12);
  for (let attempt = 0; attempt < 8; attempt++) {
    const shortCode = randomShortCode(8);
    try {
      const [inserted] = await db
        .insert(users)
        .values({ id: phone, phone, passwordHash, shortCode })
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
