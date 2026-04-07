import { compare } from "bcryptjs";
import { eq, lt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users, webauthnLoginCodes } from "@/db/schema";

const passwordLogin = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const passkeyLogin = z.object({
  passkeyCode: z.string().min(16),
});

/** Вызывается только на Node при логине — не импортировать из edge-middleware. */
export async function authorizeCredentials(raw: unknown) {
  const asPk = passkeyLogin.safeParse(raw);
  if (asPk.success) {
    await db
      .delete(webauthnLoginCodes)
      .where(lt(webauthnLoginCodes.expiresAt, new Date()));
    const [row] = await db
      .select()
      .from(webauthnLoginCodes)
      .where(eq(webauthnLoginCodes.code, asPk.data.passkeyCode))
      .limit(1);
    if (!row || row.expiresAt < new Date()) {
      return null;
    }
    await db.delete(webauthnLoginCodes).where(eq(webauthnLoginCodes.code, row.code));
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, row.userId))
      .limit(1);
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.displayName ?? undefined,
    };
  }

  const parsed = passwordLogin.safeParse(raw);
  if (!parsed.success) return null;
  const { email, password } = parsed.data;
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);
  if (!row) return null;
  const ok = await compare(password, row.passwordHash);
  if (!ok) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.displayName ?? undefined,
  };
}
