import {
  getLastGroupMessagePreview,
  listRecentSidebar,
} from "@/lib/chat/local-db";
import { setInboxCache } from "@/lib/chat/inbox-cache";

type ApiGroup = {
  id: string;
  name: string;
  role: string;
  createdAt: string;
  lastMessageAt: string | null;
};

export type UnifiedInboxRow =
  | {
      kind: "dm";
      peerId: string;
      label: string;
      preview: string;
      lastAt: number;
      lastDirection: "in" | "out";
    }
  | {
      kind: "group";
      groupId: string;
      label: string;
      preview: string;
      lastAt: number;
      lastMessageAt: string | null;
      role: string;
    };

/** Лички из локального списка + группы с сервера, по убыванию времени последнего сообщения. */
export async function loadUnifiedInboxRows(): Promise<UnifiedInboxRow[]> {
  const [sidebar, groupsRes] = await Promise.all([
    listRecentSidebar(),
    fetch("/api/groups", { credentials: "include" }),
  ]);

  const apiGroups: ApiGroup[] = groupsRes.ok
    ? ((await groupsRes.json()) as ApiGroup[])
    : [];

  const dmRows: UnifiedInboxRow[] = sidebar.map((c) => ({
    kind: "dm",
    peerId: c.peerId,
    label: c.label,
    preview: c.preview,
    lastAt: c.lastAt,
    lastDirection: c.lastDirection,
  }));

  const groupRows: UnifiedInboxRow[] = await Promise.all(
    apiGroups.map(async (g) => {
      const localPreview = await getLastGroupMessagePreview(g.id);
      const lastMsgMs = g.lastMessageAt
        ? new Date(g.lastMessageAt).getTime()
        : null;
      const createdMs = new Date(g.createdAt).getTime();
      const lastAt = lastMsgMs ?? createdMs;
      const preview =
        localPreview ??
        (g.role === "admin" ? "Группа · админ" : "Группа · участник");
      return {
        kind: "group" as const,
        groupId: g.id,
        label: g.name,
        preview,
        lastAt,
        lastMessageAt: g.lastMessageAt,
        role: g.role,
      };
    })
  );

  const merged = [...dmRows, ...groupRows].sort((a, b) => b.lastAt - a.lastAt);
  setInboxCache(merged);
  return merged;
}
