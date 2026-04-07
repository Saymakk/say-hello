import type { UnifiedInboxRow } from "@/lib/chat/unified-inbox";

let memory: UnifiedInboxRow[] | null = null;

export function getInboxCache(): UnifiedInboxRow[] {
  return memory ?? [];
}

export function setInboxCache(rows: UnifiedInboxRow[]) {
  memory = rows;
}

export function clearInboxCache() {
  memory = null;
}
