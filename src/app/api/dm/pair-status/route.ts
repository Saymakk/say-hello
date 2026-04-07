import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { dmRequests, userBlocks } from "@/db/schema";
import {
  hasAllowedPair,
  hasBlockBetween,
} from "@/lib/server/dm-access";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const me = session.user.id;
  const { searchParams } = new URL(request.url);
  const peerId = searchParams.get("peerId")?.trim() ?? "";
  if (!UUID_RE.test(peerId)) {
    return NextResponse.json({ error: "Некорректный peerId" }, { status: 400 });
  }
  if (peerId === me) {
    return NextResponse.json({ error: "Нельзя" }, { status: 400 });
  }

  const blocked = await hasBlockBetween(me, peerId);
  const allowed = await hasAllowedPair(me, peerId);

  const [bm] = await db
    .select()
    .from(userBlocks)
    .where(
      and(eq(userBlocks.blockerId, me), eq(userBlocks.blockedId, peerId))
    )
    .limit(1);
  const [bt] = await db
    .select()
    .from(userBlocks)
    .where(
      and(eq(userBlocks.blockerId, peerId), eq(userBlocks.blockedId, me))
    )
    .limit(1);

  const [incoming] = await db
    .select()
    .from(dmRequests)
    .where(
      and(
        eq(dmRequests.fromUserId, peerId),
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
        eq(dmRequests.toUserId, peerId),
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
        eq(dmRequests.toUserId, peerId),
        eq(dmRequests.status, "declined")
      )
    )
    .limit(1);

  return NextResponse.json({
    canSendDm: allowed,
    blocked,
    blockedByMe: !!bm,
    blockedByThem: !!bt,
    incomingRequestId: incoming?.id ?? null,
    outgoingPending: !!outgoing,
    outgoingDeclined: !!outDeclined,
  });
}
