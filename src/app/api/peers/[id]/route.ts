import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { dmRequests, userBlocks, users } from "@/db/schema";
import {
  hasAllowedPair,
  hasBlockBetween,
} from "@/lib/server/dm-access";

type Ctx = { params: Promise<{ id: string }> };

/** Публичные поля собеседника + статус переписки и блокировок. */
export async function GET(_request: Request, context: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const me = session.user.id;
  const { id } = await context.params;
  if (id === me) {
    return NextResponse.json({ error: "Это вы" }, { status: 400 });
  }
  const [row] = await db
    .select({
      id: users.id,
      shortCode: users.shortCode,
      displayName: users.displayName,
      publicKeyJwk: users.publicKeyJwk,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  const blocked = await hasBlockBetween(me, id);
  const allowed = await hasAllowedPair(me, id);

  const [bm] = await db
    .select()
    .from(userBlocks)
    .where(
      and(eq(userBlocks.blockerId, me), eq(userBlocks.blockedId, id))
    )
    .limit(1);
  const [bt] = await db
    .select()
    .from(userBlocks)
    .where(
      and(eq(userBlocks.blockerId, id), eq(userBlocks.blockedId, me))
    )
    .limit(1);

  const [incoming] = await db
    .select({ id: dmRequests.id })
    .from(dmRequests)
    .where(
      and(
        eq(dmRequests.fromUserId, id),
        eq(dmRequests.toUserId, me),
        eq(dmRequests.status, "pending")
      )
    )
    .limit(1);

  const [outgoing] = await db
    .select()
    .from(dmRequests)
    .where(
      and(
        eq(dmRequests.fromUserId, me),
        eq(dmRequests.toUserId, id),
        eq(dmRequests.status, "pending")
      )
    )
    .limit(1);

  const [outDeclined] = await db
    .select()
    .from(dmRequests)
    .where(
      and(
        eq(dmRequests.fromUserId, me),
        eq(dmRequests.toUserId, id),
        eq(dmRequests.status, "declined")
      )
    )
    .limit(1);

  return NextResponse.json({
    ...row,
    dm: {
      canSendDm: allowed,
      blocked,
      blockedByMe: !!bm,
      blockedByThem: !!bt,
      incomingRequestId: incoming?.id ?? null,
      outgoingPending: !!outgoing,
      outgoingDeclined: !!outDeclined,
    },
  });
}
