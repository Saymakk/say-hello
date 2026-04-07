import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/types";
import { auth } from "@/auth";
import { db } from "@/db";
import { webauthnChallenges, webauthnCredentials } from "@/db/schema";
import { purgeExpiredWebAuthnChallenges } from "@/lib/webauthn/challenges";
import {
  getWebAuthnExpectedOrigin,
  getWebAuthnRpId,
} from "@/lib/webauthn/config";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  await purgeExpiredWebAuthnChallenges();

  let body: RegistrationResponseJSON;
  try {
    body = (await request.json()) as RegistrationResponseJSON;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const [ch] = await db
    .select()
    .from(webauthnChallenges)
    .where(
      and(
        eq(webauthnChallenges.userId, session.user.id),
        eq(webauthnChallenges.kind, "registration")
      )
    )
    .orderBy(desc(webauthnChallenges.expiresAt))
    .limit(1);

  if (!ch || ch.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Сессия регистрации истекла. Запросите новые опции." },
      { status: 400 }
    );
  }

  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const rpID = getWebAuthnRpId(host);
  const expectedOrigin = getWebAuthnExpectedOrigin(request);

  const verification = await verifyRegistrationResponse({
    response: body,
    expectedChallenge: ch.challenge,
    expectedOrigin,
    expectedRPID: rpID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "Проверка passkey не прошла" }, { status: 400 });
  }

  const info = verification.registrationInfo;
  const credentialIdStr = isoBase64URL.fromBuffer(info.credentialID);
  const publicKeyB64 = Buffer.from(info.credentialPublicKey).toString("base64");

  await db.insert(webauthnCredentials).values({
    userId: session.user.id,
    credentialId: credentialIdStr,
    publicKey: publicKeyB64,
    counter: info.counter,
  });

  await db.delete(webauthnChallenges).where(eq(webauthnChallenges.id, ch.id));

  return NextResponse.json({ ok: true });
}
