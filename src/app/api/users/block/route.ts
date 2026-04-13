import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { dmAllowedPairs, dmRequests, userBlocks } from "@/db/schema";
import { canonicalPair } from "@/lib/server/dm-access";
import { isValidPhone, normalizePhone } from "@/lib/phone";

const bodySchema = z.object({
  peerId: z.string().min(5),
});

/** Заблокировать пользователя (он не сможет писать вам; переписка закрывается). */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const me = session.user.id;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }
  const peerId = normalizePhone(parsed.data.peerId);
  if (!isValidPhone(peerId)) {
    return NextResponse.json({ error: "Некорректный номер пользователя" }, { status: 400 });
  }
  if (peerId === me) {
    return NextResponse.json({ error: "Нельзя" }, { status: 400 });
  }

  await db
    .insert(userBlocks)
    .values({ blockerId: me, blockedId: peerId })
    .onConflictDoNothing();

  const [ua, ub] = canonicalPair(me, peerId);
  await db
    .delete(dmAllowedPairs)
    .where(
      and(eq(dmAllowedPairs.userA, ua), eq(dmAllowedPairs.userB, ub))
    );

  await db
    .delete(dmRequests)
    .where(
      and(
        eq(dmRequests.fromUserId, peerId),
        eq(dmRequests.toUserId, me),
        eq(dmRequests.status, "pending")
      )
    );

  await db
    .delete(dmRequests)
    .where(
      and(
        eq(dmRequests.fromUserId, me),
        eq(dmRequests.toUserId, peerId),
        eq(dmRequests.status, "pending")
      )
    );

  return NextResponse.json({ ok: true });
}

/** Снять блокировку. */
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const me = session.user.id;
  const { searchParams } = new URL(request.url);
  const peerIdRaw = searchParams.get("peerId")?.trim() ?? "";
  const peerId = normalizePhone(peerIdRaw);
  if (!isValidPhone(peerId)) {
    return NextResponse.json({ error: "Некорректный peerId" }, { status: 400 });
  }

  await db
    .delete(userBlocks)
    .where(
      and(eq(userBlocks.blockerId, me), eq(userBlocks.blockedId, peerId))
    );

  return NextResponse.json({ ok: true });
}
