/** RP ID для WebAuthn: в проде задайте WEBAUTHN_RP_ID (домен без порта). */
export function getWebAuthnRpId(hostHeader: string | null): string {
  const fromEnv = process.env.WEBAUTHN_RP_ID?.trim();
  if (fromEnv) return fromEnv;
  const host = (hostHeader ?? "localhost").split(":")[0] ?? "localhost";
  if (host === "localhost" || host === "127.0.0.1") return "localhost";
  return host;
}

export function getWebAuthnExpectedOrigin(req: Request): string {
  const list = process.env.WEBAUTHN_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get("origin");
  if (origin) return origin;
  const ref = req.headers.get("referer");
  if (ref) {
    try {
      return new URL(ref).origin;
    } catch {
      /* */
    }
  }
  if (list?.length) return list[0]!;
  return "http://localhost:3000";
}

export function webAuthnRpName() {
  return "Say Hello";
}
