/**
 * Резервная доставка лички через /api/signals (когда WebRTC не поднимается).
 */

export type DmRelayPayload =
  | {
      kind: "dm-text";
      msgId: string;
      body: string;
      ts: number;
      enc?: false;
      replyToId?: string;
      replySnippet?: string;
    }
  | {
      kind: "dm-text";
      msgId: string;
      ts: number;
      enc: true;
      c: string;
      replyToId?: string;
      replySnippet?: string;
    }
  | {
      kind: "dm-image";
      msgId: string;
      body: string;
      ts: number;
      enc?: false;
      replyToId?: string;
      replySnippet?: string;
    }
  | {
      kind: "dm-image";
      msgId: string;
      ts: number;
      enc: true;
      c: string;
      replyToId?: string;
      replySnippet?: string;
    }
  | {
      kind: "dm-text-edit";
      msgId: string;
      body: string;
      ts: number;
      enc?: false;
    }
  | {
      kind: "dm-text-edit";
      msgId: string;
      ts: number;
      enc: true;
      c: string;
    }
  | {
      kind: "dm-delete";
      msgId: string;
      ts: number;
    };

export async function postDmRelay(toUserId: string, payload: DmRelayPayload) {
  const res = await fetch("/api/signals", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      toUserId,
      payload: JSON.stringify(payload),
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg =
      typeof (data as { error?: string }).error === "string"
        ? (data as { error: string }).error
        : "Не удалось отправить";
    throw new Error(msg);
  }
}
