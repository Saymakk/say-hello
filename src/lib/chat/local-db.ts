import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { generateEcdhKeyPair } from "@/lib/crypto/dm-e2e";
import {
  clearAllReadState,
  removeDmRead,
  removeGroupRead,
} from "@/lib/chat/read-state";

/** Локальная подпись к контакту (как удобно назвать). */
export type ContactRow = {
  peerId: string;
  shortCode: string;
  displayName: string | null;
  /** Ваше имя для контакта; не синхронизируется с сервером. */
  localAlias?: string | null;
  updatedAt: number;
};

export type DmMessageRow = {
  id: string;
  peerId: string;
  direction: "in" | "out";
  body: string;
  /** text — обычное сообщение; image — body = data URL */
  kind?: "text" | "image";
  createdAt: number;
  editedAt?: number;
  deleted?: boolean;
  /** Ответ на сообщение (id и короткая подпись для отображения). */
  replyToId?: string;
  replySnippet?: string;
};

export type E2eIdentityRow = {
  id: "self";
  privateJwk: JsonWebKey;
  publicJwk: JsonWebKey;
};

/** Кэш групповых сообщений (зеркало ответа API) для офлайн-просмотра. */
export type GroupMessageLocalRow = {
  id: string;
  groupId: string;
  body: string;
  imageDataUrl: string | null;
  createdAt: string;
  editedAt?: string | null;
  userId: string;
  shortCode: string;
  displayName: string | null;
};

interface ChatDB extends DBSchema {
  contacts: {
    key: string;
    value: ContactRow;
  };
  dmMessages: {
    key: string;
    value: DmMessageRow;
    indexes: { "by-peer": string };
  };
  e2eIdentity: {
    key: string;
    value: E2eIdentityRow;
  };
  groupMessages: {
    key: string;
    value: GroupMessageLocalRow;
    indexes: { "by-group": string };
  };
  /** Симметричный ключ группы (для E2E групповых сообщений через signals). */
  groupKeys: {
    key: string;
    value: { groupId: string; keyB64: string };
  };
}

const DB_NAME = "say-hello-chat";
const DB_VERSION = 6;

let dbPromise: Promise<IDBPDatabase<ChatDB>> | null = null;

export function getChatDb() {
  if (!dbPromise) {
    dbPromise = openDB<ChatDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains("contacts")) {
            db.createObjectStore("contacts", { keyPath: "peerId" });
          }
          if (!db.objectStoreNames.contains("dmMessages")) {
            const s = db.createObjectStore("dmMessages", { keyPath: "id" });
            s.createIndex("by-peer", "peerId");
          }
        }
        if (oldVersion < 2) {
          /* v2: localAlias — без новых store */
        }
        if (oldVersion < 3) {
          if (!db.objectStoreNames.contains("e2eIdentity")) {
            db.createObjectStore("e2eIdentity", { keyPath: "id" });
          }
        }
        if (oldVersion < 4) {
          if (!db.objectStoreNames.contains("groupMessages")) {
            const s = db.createObjectStore("groupMessages", { keyPath: "id" });
            s.createIndex("by-group", "groupId");
          }
        }
        if (oldVersion < 5) {
          if (!db.objectStoreNames.contains("groupKeys")) {
            db.createObjectStore("groupKeys", { keyPath: "groupId" });
          }
        }
        /** Восстановить отсутствующие хранилища (сбой миграции, старая сборка). */
        if (oldVersion < 6) {
          if (!db.objectStoreNames.contains("groupKeys")) {
            db.createObjectStore("groupKeys", { keyPath: "groupId" });
          }
          if (!db.objectStoreNames.contains("groupMessages")) {
            const s = db.createObjectStore("groupMessages", { keyPath: "id" });
            s.createIndex("by-group", "groupId");
          }
          if (!db.objectStoreNames.contains("e2eIdentity")) {
            db.createObjectStore("e2eIdentity", { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains("contacts")) {
            db.createObjectStore("contacts", { keyPath: "peerId" });
          }
          if (!db.objectStoreNames.contains("dmMessages")) {
            const s = db.createObjectStore("dmMessages", { keyPath: "id" });
            s.createIndex("by-peer", "peerId");
          }
        }
      },
    });
  }
  return dbPromise;
}

export async function getGroupMessagesLocal(
  groupId: string
): Promise<GroupMessageLocalRow[]> {
  const db = await getChatDb();
  const rows = await db.getAllFromIndex("groupMessages", "by-group", groupId);
  return rows.sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

export async function saveGroupMessagesCache(
  groupId: string,
  rows: Omit<GroupMessageLocalRow, "groupId">[]
) {
  const db = await getChatDb();
  const tx = db.transaction("groupMessages", "readwrite");
  const store = tx.store;
  const prev = await store.index("by-group").getAll(groupId);
  for (const p of prev) await store.delete(p.id);
  for (const r of rows) {
    await store.put({ ...r, groupId });
  }
  await tx.done;
}

export async function deleteGroupMessagesLocal(groupId: string) {
  const db = await getChatDb();
  const tx = db.transaction("groupMessages", "readwrite");
  const store = tx.store;
  const prev = await store.index("by-group").getAll(groupId);
  for (const p of prev) await store.delete(p.id);
  await tx.done;
}

export async function getE2eIdentity(): Promise<E2eIdentityRow | null> {
  const db = await getChatDb();
  const row = await db.get("e2eIdentity", "self");
  return row ?? null;
}

export async function ensureE2eIdentity(): Promise<E2eIdentityRow> {
  const db = await getChatDb();
  const prev = await db.get("e2eIdentity", "self");
  if (prev) return prev;
  const { privateJwk, publicJwk } = await generateEcdhKeyPair();
  const row: E2eIdentityRow = { id: "self", privateJwk, publicJwk };
  await db.put("e2eIdentity", row);
  return row;
}

export async function upsertContact(row: ContactRow) {
  const db = await getChatDb();
  const prev = await db.get("contacts", row.peerId);
  await db.put("contacts", {
    ...row,
    localAlias:
      row.localAlias !== undefined
        ? row.localAlias
        : (prev?.localAlias ?? null),
    updatedAt: Date.now(),
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("say-hello-chat-updated"));
  }
}

export async function setContactAlias(peerId: string, localAlias: string | null) {
  const db = await getChatDb();
  const prev = await db.get("contacts", peerId);
  if (!prev) return;
  await db.put("contacts", {
    ...prev,
    localAlias: localAlias?.trim() || null,
    updatedAt: Date.now(),
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("say-hello-chat-updated"));
  }
}

export async function getContact(peerId: string): Promise<ContactRow | undefined> {
  const db = await getChatDb();
  return db.get("contacts", peerId);
}

export async function listContacts(): Promise<ContactRow[]> {
  const db = await getChatDb();
  return db.getAll("contacts");
}

export async function addDmMessage(msg: DmMessageRow) {
  const db = await getChatDb();
  await db.put("dmMessages", msg);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("say-hello-chat-updated"));
  }
}

export async function patchDmMessageLocal(
  id: string,
  peerId: string,
  patch: Partial<Pick<DmMessageRow, "body" | "editedAt" | "deleted">>
) {
  const db = await getChatDb();
  const prev = await db.get("dmMessages", id);
  if (!prev || prev.peerId !== peerId) return false;
  await db.put("dmMessages", { ...prev, ...patch });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("say-hello-chat-updated"));
  }
  return true;
}

export async function getDmMessages(peerId: string): Promise<DmMessageRow[]> {
  const db = await getChatDb();
  const rows = await db.getAllFromIndex("dmMessages", "by-peer", peerId);
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function listDmConversations(): Promise<
  {
    peerId: string;
    preview: string;
    lastAt: number;
    lastDirection: "in" | "out";
    shortCode?: string;
    displayName?: string | null;
    localAlias?: string | null;
  }[]
> {
  const db = await getChatDb();
  const all = await db.getAll("dmMessages");
  const byPeer = new Map<
    string,
    { preview: string; lastAt: number; lastDirection: "in" | "out" }
  >();
  for (const m of all) {
    const prev = byPeer.get(m.peerId);
    const preview = m.deleted
      ? "Сообщение удалено"
      : m.kind === "image"
        ? "📷 Фото"
        : m.body.slice(0, 80);
    if (!prev || m.createdAt >= prev.lastAt) {
      byPeer.set(m.peerId, {
        preview,
        lastAt: m.createdAt,
        lastDirection: m.direction,
      });
    }
  }
  const contacts = await listContacts();
  const cMap = new Map(contacts.map((c) => [c.peerId, c]));
  return [...byPeer.entries()]
    .map(([peerId, { preview, lastAt, lastDirection }]) => {
      const c = cMap.get(peerId);
      return {
        peerId,
        preview,
        lastAt,
        lastDirection,
        shortCode: c?.shortCode,
        displayName: c?.displayName,
        localAlias: c?.localAlias,
      };
    })
    .sort((a, b) => b.lastAt - a.lastAt);
}

/** Удалить все локальные чаты и ключи (контакты, сообщения, E2E, кэш групп). */
export async function clearAllLocalChatData() {
  const db = await getChatDb();
  await db.clear("dmMessages");
  await db.clear("contacts");
  await db.clear("e2eIdentity");
  await db.clear("groupMessages");
  await db.clear("groupKeys");
  clearAllReadState();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("say-hello-chat-updated"));
  }
}

export type ChatDumpV2 = {
  v: 2;
  exportedAt: number;
  contacts: ContactRow[];
  dmMessages: DmMessageRow[];
  e2eIdentity: E2eIdentityRow | null;
  groupMessages: GroupMessageLocalRow[];
};

export async function exportLocalChatDump(): Promise<ChatDumpV2> {
  const db = await getChatDb();
  const contacts = await db.getAll("contacts");
  const dmMessages = await db.getAll("dmMessages");
  const groupMessages = await db.getAll("groupMessages");
  const e2eIdentity = (await db.get("e2eIdentity", "self")) ?? null;
  return {
    v: 2,
    exportedAt: Date.now(),
    contacts,
    dmMessages,
    e2eIdentity,
    groupMessages,
  };
}

export async function importLocalChatDump(
  data: unknown,
  mode: "merge" | "replace"
) {
  const d = data as {
    v?: number;
    contacts?: ContactRow[];
    dmMessages?: DmMessageRow[];
    e2eIdentity?: E2eIdentityRow | null;
    groupMessages?: GroupMessageLocalRow[];
  };
  if (d.v !== 1 && d.v !== 2) {
    throw new Error("Неверный формат дампа");
  }
  if (!Array.isArray(d.contacts) || !Array.isArray(d.dmMessages)) {
    throw new Error("Неверный формат дампа");
  }
  const groupMessages = Array.isArray(d.groupMessages) ? d.groupMessages : [];
  const db = await getChatDb();
  if (mode === "replace") {
    await db.clear("dmMessages");
    await db.clear("contacts");
    await db.clear("e2eIdentity");
    await db.clear("groupMessages");
  }
  if (d.e2eIdentity && mode === "replace") {
    await db.put("e2eIdentity", d.e2eIdentity);
  }
  for (const c of d.contacts) {
    await db.put("contacts", c);
  }
  for (const m of d.dmMessages) {
    await db.put("dmMessages", m);
  }
  for (const g of groupMessages) {
    await db.put("groupMessages", g);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("say-hello-chat-updated"));
  }
}

export async function getGroupKeyB64(groupId: string): Promise<string | null> {
  const db = await getChatDb();
  const row = await db.get("groupKeys", groupId);
  return row?.keyB64 ?? null;
}

export async function setGroupKeyB64(groupId: string, keyB64: string) {
  const db = await getChatDb();
  await db.put("groupKeys", { groupId, keyB64 });
}

/** Удалить локально переписку с контактом (без сервера). */
export async function deleteDmChatLocally(peerId: string) {
  const db = await getChatDb();
  const rows = await db.getAllFromIndex("dmMessages", "by-peer", peerId);
  for (const m of rows) await db.delete("dmMessages", m.id);
  await db.delete("contacts", peerId);
  removeDmRead(peerId);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("say-hello-chat-updated"));
  }
}

/** Удалить локальный кэш группы и ключ группы. */
export async function deleteGroupChatLocally(groupId: string) {
  await deleteGroupMessagesLocal(groupId);
  const db = await getChatDb();
  await db.delete("groupKeys", groupId);
  removeGroupRead(groupId);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("say-hello-chat-updated"));
  }
}

export async function getLastGroupMessagePreview(groupId: string): Promise<string | null> {
  const rows = await getGroupMessagesLocal(groupId);
  if (rows.length === 0) return null;
  const last = rows[rows.length - 1]!;
  if (last.imageDataUrl) return "📷 Фото";
  const t = last.body.trim();
  if (!t || t === " ") return "Сообщение";
  return t.length > 80 ? `${t.slice(0, 80)}…` : t;
}

/** Недавние: контакты (в т.ч. только что найденные) + превью переписки. */
export async function listRecentSidebar(): Promise<
  {
    peerId: string;
    label: string;
    preview: string;
    lastAt: number;
    lastDirection: "in" | "out";
  }[]
> {
  const contacts = await listContacts();
  const convs = await listDmConversations();
  const convMap = new Map(convs.map((c) => [c.peerId, c]));

  const rows = contacts
    .map((c) => {
      const conv = convMap.get(c.peerId);
      const label =
        (c.localAlias?.trim() && c.localAlias.trim()) ||
        c.displayName ||
        c.shortCode ||
        c.peerId.slice(0, 8);
      const preview = conv?.preview ?? "Нет сообщений";
      const lastAt = conv?.lastAt ?? c.updatedAt;
      const lastDirection = conv?.lastDirection ?? "out";
      return { peerId: c.peerId, label, preview, lastAt, lastDirection };
    })
    .sort((a, b) => b.lastAt - a.lastAt);

  return rows.slice(0, 25);
}
