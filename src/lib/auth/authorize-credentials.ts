import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** Вызывается только на Node при логине — не импортировать из edge-middleware. */
export async function authorizeCredentials(raw: unknown) {
  const parsed = schema.safeParse(raw);
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
