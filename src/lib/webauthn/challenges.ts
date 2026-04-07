import { lt } from "drizzle-orm";
import { db } from "@/db";
import { webauthnChallenges } from "@/db/schema";

export async function purgeExpiredWebAuthnChallenges() {
  await db.delete(webauthnChallenges).where(lt(webauthnChallenges.expiresAt, new Date()));
}
