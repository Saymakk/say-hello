const STORAGE_OBF = "say-hello-chat-obfuscate";
const STORAGE_UNLOCK = "say-hello-obfuscate-unlock-count";

export function readObfuscateEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_OBF) === "1";
}

export function writeObfuscateEnabled(on: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_OBF, on ? "1" : "0");
  window.dispatchEvent(new CustomEvent("say-hello-obfuscate-changed"));
}

export function readUnlockSuccessCount(): number {
  if (typeof window === "undefined") return 0;
  const n = parseInt(sessionStorage.getItem(STORAGE_UNLOCK) ?? "0", 10);
  return Number.isFinite(n) ? n : 0;
}

export function incrementUnlockSuccessCount(): number {
  if (typeof window === "undefined") return 0;
  const n = readUnlockSuccessCount() + 1;
  sessionStorage.setItem(STORAGE_UNLOCK, String(n));
  return n;
}

export function clearUnlockSuccessCount() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_UNLOCK);
}

/** Визуально «ломает» строку для экрана (данные в БД не меняются). */
export function obfuscateChatText(input: string): string {
  if (!input) return input;
  return [...input]
    .map((ch) => {
      if (ch === "\n" || ch === "\r" || ch === "\t" || ch === " ") return ch;
      const cp = ch.codePointAt(0)!;
      return String.fromCodePoint(0x25a0 + (cp % 16));
    })
    .join("");
}
