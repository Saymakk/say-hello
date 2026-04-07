import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { dmAllowedPairs, userBlocks } from "@/db/schema";

export function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function hasBlockBetween(
  userId1: string,
  userId2: string
): Promise<boolean> {
  const rows = await db
    .select()
    .from(userBlocks)
    .where(
      or(
        and(
          eq(userBlocks.blockerId, userId1),
          eq(userBlocks.blockedId, userId2)
        ),
        and(
          eq(userBlocks.blockerId, userId2),
          eq(userBlocks.blockedId, userId1)
        )
      )
    )
    .limit(1);
  return rows.length > 0;
}

export async function hasAllowedPair(
  userId1: string,
  userId2: string
): Promise<boolean> {
  const [ua, ub] = canonicalPair(userId1, userId2);
  const rows = await db
    .select()
    .from(dmAllowedPairs)
    .where(
      and(eq(dmAllowedPairs.userA, ua), eq(dmAllowedPairs.userB, ub))
    )
    .limit(1);
  return rows.length > 0;
}

/** Релей личного текста разрешён только при открытой паре и без блокировки. */
export async function ensureDmTextAllowed(
  fromUserId: string,
  toUserId: string
): Promise<boolean> {
  if (fromUserId === toUserId) return false;
  if (await hasBlockBetween(fromUserId, toUserId)) return false;
  return hasAllowedPair(fromUserId, toUserId);
}
