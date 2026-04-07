import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { dmRequests, signalPackets, users } from "@/db/schema";
import { hasAllowedPair, hasBlockBetween } from "@/lib/server/dm-access";

const postSchema = z.object({
  toUserId: z.string().uuid(),
  firstMessagePreview: z.string().max(400).optional(),
});

/**
 * Создать запрос на переписку (уведомление адресату). Пока нет пары — личные сообщения не релеятся.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const uid = session.user.id;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { toUserId, firstMessagePreview } = parsed.data;
  if (toUserId === uid) {
    return NextResponse.json({ error: "Нельзя" }, { status: 400 });
  }

  if (await hasBlockBetween(uid, toUserId)) {
    return NextResponse.json(
      { error: "Нельзя связаться с этим пользователем" },
      { status: 403 }
    );
  }

  if (await hasAllowedPair(uid, toUserId)) {
    return NextResponse.json({ error: "Переписка уже открыта" }, { status: 400 });
  }

  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, toUserId))
    .limit(1);
  if (!target) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  const [existing] = await db
    .select()
    .from(dmRequests)
    .where(
      and(eq(dmRequests.fromUserId, uid), eq(dmRequests.toUserId, toUserId))
    )
    .limit(1);

  const preview = firstMessagePreview?.trim() || null;

  let requestId: string;

  if (existing) {
    if (existing.status === "pending") {
      return NextResponse.json({
        id: existing.id,
        status: "pending",
        message: "Запрос уже отправлен",
      });
    }
    if (existing.status === "declined") {
      await db
        .update(dmRequests)
        .set({
          status: "pending",
          firstMessagePreview: preview,
        })
        .where(eq(dmRequests.id, existing.id));
      requestId = existing.id;
    } else {
      return NextResponse.json({ error: "Некорректное состояние" }, { status: 400 });
    }
  } else {
    const [ins] = await db
      .insert(dmRequests)
      .values({
        fromUserId: uid,
        toUserId,
        status: "pending",
        firstMessagePreview: preview,
      })
      .returning({ id: dmRequests.id });
    if (!ins) {
      return NextResponse.json({ error: "Не удалось создать" }, { status: 500 });
    }
    requestId = ins.id;
  }

  const [fromUser] = await db
    .select({
      shortCode: users.shortCode,
      displayName: users.displayName,
    })
    .from(users)
    .where(eq(users.id, uid))
    .limit(1);

  const invitePayload = JSON.stringify({
    kind: "dm-invite",
    requestId,
    fromId: uid,
    shortCode: fromUser?.shortCode ?? "",
    displayName: fromUser?.displayName ?? null,
    firstMessagePreview: preview,
  });

  await db.insert(signalPackets).values({
    fromUserId: uid,
    toUserId,
    payload: invitePayload,
  });

  return NextResponse.json({
    id: requestId,
    status: "pending",
  });
}
