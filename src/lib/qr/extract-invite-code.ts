/** Извлекает короткий код из URL приглашения или сырого текста QR. */
export function extractInviteCodeFromQrText(text: string): string | null {
  const raw = text.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const c = u.searchParams.get("c");
    if (c && c.trim().length >= 4) return c.trim().toUpperCase();
  } catch {
    /* относительный URL или не URL */
  }
  const rel = raw.match(/[?&]c=([^&\s#]+)/i);
  if (rel?.[1]) {
    try {
      const v = decodeURIComponent(rel[1]).trim().toUpperCase();
      if (v.length >= 4) return v;
    } catch {
      const v = rel[1].trim().toUpperCase();
      if (v.length >= 4) return v;
    }
  }
  const compact = raw.replace(/\s/g, "").toUpperCase();
  if (/^[A-Z0-9]{4,16}$/.test(compact)) return compact;
  return null;
}
