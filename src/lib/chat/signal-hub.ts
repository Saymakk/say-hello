/**
 * Один общий опрос /api/signals: раздаёт входящие payload по peerId (fromUserId).
 */

type Handler = (payload: string) => void;

const handlers = new Map<string, Handler>();
const processedIds = new Set<string>();
let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastSince: Date = new Date(Date.now() - 120_000);
let refCount = 0;

function ensurePoll() {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    void poll();
  }, 1500);
}

function stopPollIfIdle() {
  if (refCount <= 0 && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function poll() {
  if (handlers.size === 0) return;
  try {
    const params = new URLSearchParams();
    params.set("since", lastSince.toISOString());
    const res = await fetch(`/api/signals?${params}`, { credentials: "include" });
    if (!res.ok) return;
    const rows = (await res.json()) as {
      id: string;
      fromUserId: string;
      payload: string;
      createdAt: string;
    }[];
    for (const row of rows) {
      if (processedIds.has(row.id)) continue;
      processedIds.add(row.id);
      if (processedIds.size > 800) {
        const it = processedIds.values().next();
        if (!it.done) processedIds.delete(it.value);
      }
      const h = handlers.get(row.fromUserId);
      if (h) {
        try {
          h(row.payload);
        } catch {
          /* ignore */
        }
      }
      const t = new Date(row.createdAt);
      if (t > lastSince) lastSince = t;
    }
  } catch {
    /* offline */
  }
}

export function registerSignalHandler(peerId: string, handler: Handler) {
  handlers.set(peerId, handler);
  refCount++;
  ensurePoll();
  void poll();
}

export function unregisterSignalHandler(peerId: string) {
  handlers.delete(peerId);
  refCount--;
  stopPollIfIdle();
}
