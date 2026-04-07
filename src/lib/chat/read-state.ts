/** Локальные отметки «прочитано» (время последнего просмотра чата). */

const DM = "say-hello-read-dm:";
const GRP = "say-hello-read-grp:";

export function getDmLastReadMs(peerId: string): number {
  if (typeof window === "undefined") return 0;
  const v = localStorage.getItem(DM + peerId);
  if (!v) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function setDmLastReadMs(peerId: string, atMs: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DM + peerId, String(atMs));
  window.dispatchEvent(new CustomEvent("say-hello-read-updated"));
}

export function getGroupLastReadMs(groupId: string): number {
  if (typeof window === "undefined") return 0;
  const v = localStorage.getItem(GRP + groupId);
  if (!v) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function setGroupLastReadMs(groupId: string, atMs: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(GRP + groupId, String(atMs));
  window.dispatchEvent(new CustomEvent("say-hello-read-updated"));
}

export function removeDmRead(peerId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DM + peerId);
  window.dispatchEvent(new CustomEvent("say-hello-read-updated"));
}

export function removeGroupRead(groupId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(GRP + groupId);
  window.dispatchEvent(new CustomEvent("say-hello-read-updated"));
}

/** Сброс всех отметок прочитано (при экстренной очистке). */
export function clearAllReadState() {
  if (typeof window === "undefined") return;
  const keys = Object.keys(localStorage);
  for (const k of keys) {
    if (k.startsWith(DM) || k.startsWith(GRP)) localStorage.removeItem(k);
  }
  window.dispatchEvent(new CustomEvent("say-hello-read-updated"));
}
