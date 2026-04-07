import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export type ContactRow = {
  peerId: string;
  shortCode: string;
  displayName: string | null;
  updatedAt: number;
};

export type DmMessageRow = {
  id: string;
  peerId: string;
  direction: "in" | "out";
  body: string;
  createdAt: number;
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
}

const DB_NAME = "say-hello-chat";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ChatDB>> | null = null;

export function getChatDb() {
  if (!dbPromise) {
    dbPromise = openDB<ChatDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("contacts")) {
          db.createObjectStore("contacts", { keyPath: "peerId" });
        }
        if (!db.objectStoreNames.contains("dmMessages")) {
          const s = db.createObjectStore("dmMessages", { keyPath: "id" });
          s.createIndex("by-peer", "peerId");
        }
      },
    });
  }
  return dbPromise;
}

export async function upsertContact(row: ContactRow) {
  const db = await getChatDb();
  await db.put("contacts", { ...row, updatedAt: Date.now() });
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

export async function getDmMessages(peerId: string): Promise<DmMessageRow[]> {
  const db = await getChatDb();
  const rows = await db.getAllFromIndex("dmMessages", "by-peer", peerId);
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function listDmConversations(): Promise<
  { peerId: string; preview: string; lastAt: number; shortCode?: string; displayName?: string | null }[]
> {
  const db = await getChatDb();
  const all = await db.getAll("dmMessages");
  const byPeer = new Map<
    string,
    { preview: string; lastAt: number }
  >();
  for (const m of all) {
    const prev = byPeer.get(m.peerId);
    if (!prev || m.createdAt >= prev.lastAt) {
      byPeer.set(m.peerId, { preview: m.body.slice(0, 80), lastAt: m.createdAt });
    }
  }
  const contacts = await listContacts();
  const cMap = new Map(contacts.map((c) => [c.peerId, c]));
  return [...byPeer.entries()]
    .map(([peerId, { preview, lastAt }]) => {
      const c = cMap.get(peerId);
      return {
        peerId,
        preview,
        lastAt,
        shortCode: c?.shortCode,
        displayName: c?.displayName,
      };
    })
    .sort((a, b) => b.lastAt - a.lastAt);
}
