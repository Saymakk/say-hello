import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users, webauthnChallenges, webauthnCredentials } from "@/db/schema";
import { purgeExpiredWebAuthnChallenges } from "@/lib/webauthn/challenges";
import { getWebAuthnRpId } from "@/lib/webauthn/config";

const bodySchema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request) {
  await purgeExpiredWebAuthnChallenges();

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Нужен email" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  const creds = await db
    .select({ credentialId: webauthnCredentials.credentialId })
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.userId, user.id));

  if (creds.length === 0) {
    return NextResponse.json(
      { error: "Для этого аккаунта не настроен вход по Face ID / отпечатку" },
      { status: 400 }
    );
  }

  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const rpID = getWebAuthnRpId(host);

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: creds.map((c) => ({
      id: isoBase64URL.toBuffer(c.credentialId),
      type: "public-key" as const,
    })),
    userVerification: "preferred",
  });

  await db
    .delete(webauthnChallenges)
    .where(
      and(eq(webauthnChallenges.email, email), eq(webauthnChallenges.kind, "login"))
    );

  await db.insert(webauthnChallenges).values({
    userId: user.id,
    email,
    challenge: options.challenge,
    kind: "login",
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });

  return NextResponse.json(options);
}
