export function normalizePhone(raw: string): string {
  return raw.replace(/\D+/g, "");
}

export function isValidPhone(phone: string): boolean {
  return /^\d{10,15}$/.test(phone);
}
