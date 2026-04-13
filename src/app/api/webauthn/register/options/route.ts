import { generateRegistrationOptions } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, webauthnChallenges, webauthnCredentials } from "@/db/schema";
import { purgeExpiredWebAuthnChallenges } from "@/lib/webauthn/challenges";
import { getWebAuthnRpId, webAuthnRpName } from "@/lib/webauthn/config";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  await purgeExpiredWebAuthnChallenges();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  const existing = await db
    .select({ credentialId: webauthnCredentials.credentialId })
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.userId, user.id));

  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const rpID = getWebAuthnRpId(host);

  const options = await generateRegistrationOptions({
    rpName: webAuthnRpName(),
    rpID,
    userID: user.id,
    userName: user.phone,
    userDisplayName: user.displayName ?? user.phone,
    excludeCredentials: existing.map((c) => ({
      id: isoBase64URL.toBuffer(c.credentialId),
      type: "public-key" as const,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  await db
    .delete(webauthnChallenges)
    .where(
      and(
        eq(webauthnChallenges.userId, user.id),
        eq(webauthnChallenges.kind, "registration")
      )
    );

  await db.insert(webauthnChallenges).values({
    userId: user.id,
    phone: user.phone,
    challenge: options.challenge,
    kind: "registration",
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });

  return NextResponse.json(options);
}
