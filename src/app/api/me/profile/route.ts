import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

const patchSchema = z.object({
  displayName: z
    .string()
    .max(64)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
});

/** Опциональное имя/ник — только по желанию пользователя. */
export async function PATCH(request: Request) {
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
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  await db
    .update(users)
    .set({ displayName: parsed.data.displayName ?? null })
    .where(eq(users.id, session.user.id));
  return NextResponse.json({ ok: true });
}
