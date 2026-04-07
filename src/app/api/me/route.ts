import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, webauthnCredentials } from "@/db/schema";

const patchSchema = z.object({
  /** JSON.stringify(JWK) публичного ключа ECDH P-256 для E2E лички */
  publicKeyJwk: z.string().min(10).max(12_000).optional(),
});

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
      publicKeyJwk: users.publicKeyJwk,
      messageEditWindowMinutes: users.messageEditWindowMinutes,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }
  const passkeys = await db
    .select({ id: webauthnCredentials.id })
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.userId, session.user.id));
  return NextResponse.json({
    ...row,
    passkeyCount: passkeys.length,
  });
}

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
  if (parsed.data.publicKeyJwk !== undefined) {
    try {
      JSON.parse(parsed.data.publicKeyJwk) as { kty?: string };
    } catch {
      return NextResponse.json({ error: "publicKeyJwk должен быть JSON" }, { status: 400 });
    }
    await db
      .update(users)
      .set({ publicKeyJwk: parsed.data.publicKeyJwk })
      .where(eq(users.id, session.user.id));
  }
  return NextResponse.json({ ok: true });
}
