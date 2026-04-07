import {
  getGroupKeyB64,
  getGroupMessagesLocal,
  saveGroupMessagesCache,
  setGroupKeyB64,
  type GroupMessageLocalRow,
} from "@/lib/chat/local-db";

function b64encode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  const buf = raw.buffer.slice(
    raw.byteOffset,
    raw.byteOffset + raw.byteLength
  ) as ArrayBuffer;
  return crypto.subtle.importKey("raw", buf, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function postGroupSignal(groupId: string, payload: object) {
  const res = await fetch("/api/signals", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      groupId,
      payload: JSON.stringify(payload),
    }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(
      typeof (e as { error?: string }).error === "string"
        ? (e as { error: string }).error
        : "Не удалось отправить"
    );
  }
}

/** Запросить ключ у других участников; при отсутствии — сгенерировать и объявить gk1. */
async function ensureGroupKeyWithWait(groupId: string): Promise<void> {
  let b64 = await getGroupKeyB64(groupId);
  if (b64) return;
  await sendGroupRequestKeySignal(groupId);
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 450));
    b64 = await getGroupKeyB64(groupId);
    if (b64) return;
  }
  const raw = crypto.getRandomValues(new Uint8Array(32));
  b64 = b64encode(raw.buffer);
  await setGroupKeyB64(groupId, b64);
  await postGroupSignal(groupId, { kind: "gk1", keyB64: b64 });
}

async function getAesKeyForGroup(groupId: string): Promise<CryptoKey> {
  await ensureGroupKeyWithWait(groupId);
  const b64 = await getGroupKeyB64(groupId);
  if (!b64) throw new Error("Не удалось получить ключ группы");
  return importAesKey(b64decode(b64));
}

async function encryptGroupPayload(groupId: string, inner: object): Promise<string> {
  const key = await getAesKeyForGroup(groupId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(inner));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
  const combined = new Uint8Array(iv.length + ct.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ct), iv.length);
  return b64encode(combined.buffer);
}

async function decryptGroupPayload(groupId: string, cB64: string): Promise<unknown> {
  const b64 = await getGroupKeyB64(groupId);
  if (!b64) throw new Error("Нет ключа группы");
  const key = await importAesKey(b64decode(b64));
  const combined = b64decode(cB64);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return JSON.parse(new TextDecoder().decode(plain)) as unknown;
}

export async function sendGroupTextSignal(params: {
  groupId: string;
  msgId: string;
  body: string;
  createdAt: number;
  userId: string;
  shortCode: string;
  displayName: string | null;
}) {
  const inner = {
    t: "txt",
    id: params.msgId,
    body: params.body,
    createdAt: params.createdAt,
    uid: params.userId,
    sc: params.shortCode,
    dn: params.displayName,
  };
  const c = await encryptGroupPayload(params.groupId, inner);
  await postGroupSignal(params.groupId, { kind: "gm1", c });
}

export async function sendGroupImageSignal(params: {
  groupId: string;
  msgId: string;
  body: string;
  imageDataUrl: string;
  createdAt: number;
  userId: string;
  shortCode: string;
  displayName: string | null;
}) {
  const inner = {
    t: "img",
    id: params.msgId,
    body: params.body,
    imageDataUrl: params.imageDataUrl,
    createdAt: params.createdAt,
    uid: params.userId,
    sc: params.shortCode,
    dn: params.displayName,
  };
  const c = await encryptGroupPayload(params.groupId, inner);
  await postGroupSignal(params.groupId, { kind: "gm1", c });
}

export async function sendGroupEditSignal(params: {
  groupId: string;
  msgId: string;
  body: string;
  editedAt: string;
}) {
  const inner = {
    t: "edit",
    id: params.msgId,
    body: params.body,
    editedAt: params.editedAt,
  };
  const c = await encryptGroupPayload(params.groupId, inner);
  await postGroupSignal(params.groupId, { kind: "gm1", c });
}

export async function sendGroupDeleteSignal(params: {
  groupId: string;
  msgId: string;
}) {
  const inner = { t: "del", id: params.msgId };
  const c = await encryptGroupPayload(params.groupId, inner);
  await postGroupSignal(params.groupId, { kind: "gm1", c });
}

export async function sendGroupRequestKeySignal(groupId: string) {
  await postGroupSignal(groupId, { kind: "reqKey" });
}

type SignalRow = {
  id: string;
  fromUserId: string;
  payload: string;
  groupId: string | null;
  createdAt: string;
};

function rowFromInner(
  groupId: string,
  fromUserId: string,
  inner: Record<string, unknown>
): GroupMessageLocalRow | null {
  if (inner.t === "txt") {
    const id = typeof inner.id === "string" ? inner.id : "";
    const body = typeof inner.body === "string" ? inner.body : "";
    const uid = typeof inner.uid === "string" ? inner.uid : fromUserId;
    const sc = typeof inner.sc === "string" ? inner.sc : "";
    const dn = typeof inner.dn === "string" || inner.dn === null ? inner.dn : null;
    const createdAt =
      typeof inner.createdAt === "number"
        ? new Date(inner.createdAt).toISOString()
        : new Date().toISOString();
    if (!id) return null;
    return {
      id,
      groupId,
      body,
      imageDataUrl: null,
      createdAt,
      editedAt: null,
      userId: uid,
      shortCode: sc,
      displayName: dn,
    };
  }
  if (inner.t === "img") {
    const id = typeof inner.id === "string" ? inner.id : "";
    const body = typeof inner.body === "string" ? inner.body : " ";
    const imageDataUrl =
      typeof inner.imageDataUrl === "string" ? inner.imageDataUrl : null;
    const uid = typeof inner.uid === "string" ? inner.uid : fromUserId;
    const sc = typeof inner.sc === "string" ? inner.sc : "";
    const dn = typeof inner.dn === "string" || inner.dn === null ? inner.dn : null;
    const createdAt =
      typeof inner.createdAt === "number"
        ? new Date(inner.createdAt).toISOString()
        : new Date().toISOString();
    if (!id || !imageDataUrl) return null;
    return {
      id,
      groupId,
      body,
      imageDataUrl,
      createdAt,
      editedAt: null,
      userId: uid,
      shortCode: sc,
      displayName: dn,
    };
  }
  if (inner.t === "edit") {
    return null;
  }
  if (inner.t === "del") {
    return null;
  }
  return null;
}

/** Обработка входящих пакетов группы; возвращает true если были изменения. */
export async function applyGroupSignals(
  groupId: string,
  rows: SignalRow[],
  seen: Set<string>
): Promise<boolean> {
  const ordered = [...rows].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  let changed = false;
  for (const row of ordered) {
    if (row.groupId !== groupId) continue;
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    let p: Record<string, unknown>;
    try {
      p = JSON.parse(row.payload) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (p.kind === "gk1" && typeof p.keyB64 === "string") {
      const existing = await getGroupKeyB64(groupId);
      if (!existing) {
        await setGroupKeyB64(groupId, p.keyB64);
        changed = true;
      }
      continue;
    }
    if (p.kind === "reqKey") {
      const k = await getGroupKeyB64(groupId);
      if (k) await postGroupSignal(groupId, { kind: "gk1", keyB64: k });
      continue;
    }
    if (p.kind === "gm1" && typeof p.c === "string") {
      try {
        const inner = (await decryptGroupPayload(groupId, p.c)) as Record<
          string,
          unknown
        >;
        if (inner.t === "edit" && typeof inner.id === "string") {
          const body = typeof inner.body === "string" ? inner.body : "";
          const editedAt =
            typeof inner.editedAt === "string"
              ? inner.editedAt
              : new Date().toISOString();
          const list = await getGroupMessagesLocal(groupId);
          const next = list.map((m) =>
            m.id === inner.id ? { ...m, body, editedAt } : m
          );
          await saveGroupMessagesCache(groupId, next.map(stripGroupId));
          changed = true;
          continue;
        }
        if (inner.t === "del" && typeof inner.id === "string") {
          const list = await getGroupMessagesLocal(groupId);
          const next = list.filter((m) => m.id !== inner.id);
          await saveGroupMessagesCache(groupId, next.map(stripGroupId));
          changed = true;
          continue;
        }
        const newRow = rowFromInner(groupId, row.fromUserId, inner);
        if (newRow) {
          const list = await getGroupMessagesLocal(groupId);
          if (list.some((m) => m.id === newRow.id)) continue;
          const merged = [...list, newRow].sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          await saveGroupMessagesCache(groupId, merged.map(stripGroupId));
          changed = true;
        }
      } catch {
        /* нет ключа или битый пакет */
      }
    }
  }
  return changed;
}

function stripGroupId(
  r: GroupMessageLocalRow
): Omit<GroupMessageLocalRow, "groupId"> {
  const { groupId: _, ...rest } = r;
  return rest;
}
