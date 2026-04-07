import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { and, desc, eq, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";
import { randomBytes } from "crypto";
import { db } from "@/db";
import {
  webauthnChallenges,
  webauthnCredentials,
  webauthnLoginCodes,
} from "@/db/schema";
import { purgeExpiredWebAuthnChallenges } from "@/lib/webauthn/challenges";
import {
  getWebAuthnExpectedOrigin,
  getWebAuthnRpId,
} from "@/lib/webauthn/config";

export async function POST(request: Request) {
  await purgeExpiredWebAuthnChallenges();
  await db.delete(webauthnLoginCodes).where(lt(webauthnLoginCodes.expiresAt, new Date()));

  let body: AuthenticationResponseJSON;
  try {
    body = (await request.json()) as AuthenticationResponseJSON;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const credentialIdStr = body.id;
  const [cred] = await db
    .select()
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.credentialId, credentialIdStr))
    .limit(1);
  if (!cred) {
    return NextResponse.json({ error: "Ключ не найден" }, { status: 400 });
  }

  const [ch] = await db
    .select()
    .from(webauthnChallenges)
    .where(
      and(
        eq(webauthnChallenges.userId, cred.userId),
        eq(webauthnChallenges.kind, "login")
      )
    )
    .orderBy(desc(webauthnChallenges.expiresAt))
    .limit(1);

  if (!ch || ch.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Сессия входа истекла. Запросите новые опции." },
      { status: 400 }
    );
  }

  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const rpID = getWebAuthnRpId(host);
  const expectedOrigin = getWebAuthnExpectedOrigin(request);

  const verification = await verifyAuthenticationResponse({
    response: body,
    expectedChallenge: ch.challenge,
    expectedOrigin,
    expectedRPID: rpID,
    authenticator: {
      credentialID: isoBase64URL.toBuffer(cred.credentialId),
      credentialPublicKey: new Uint8Array(Buffer.from(cred.publicKey, "base64")),
      counter: cred.counter,
    },
  });

  if (!verification.verified) {
    return NextResponse.json({ error: "Проверка не прошла" }, { status: 400 });
  }

  const newCounter = verification.authenticationInfo.newCounter;
  await db
    .update(webauthnCredentials)
    .set({ counter: newCounter })
    .where(eq(webauthnCredentials.id, cred.id));

  await db.delete(webauthnChallenges).where(eq(webauthnChallenges.id, ch.id));

  const code = randomBytes(32).toString("hex");
  await db.insert(webauthnLoginCodes).values({
    code,
    userId: cred.userId,
    expiresAt: new Date(Date.now() + 120_000),
  });

  return NextResponse.json({ passkeyCode: code });
}
