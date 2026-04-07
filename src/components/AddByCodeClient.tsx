"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { QrScanModal } from "@/components/QrScanModal";
import { getContact, upsertContact } from "@/lib/chat/local-db";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type Lookup = {
  id: string;
  shortCode: string;
  displayName: string | null;
};

export function AddByCodeClient({ initialCode }: { initialCode: string }) {
  const { t } = useLocale();
  const [code, setCode] = useState(initialCode);
  const [result, setResult] = useState<Lookup | null>(null);
  const [localAlias, setLocalAlias] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  useEffect(() => {
    if (!result) {
      setLocalAlias("");
      return;
    }
    void getContact(result.id).then((c) => setLocalAlias(c?.localAlias ?? ""));
  }, [result]);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    const res = await fetch(
      `/api/users/lookup?code=${encodeURIComponent(code.trim())}`
    );
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Ошибка");
      return;
    }
    const r = data as Lookup;
    setResult(r);
    await upsertContact({
      peerId: r.id,
      shortCode: r.shortCode,
      displayName: r.displayName,
      updatedAt: Date.now(),
    });
  }

  async function saveAlias(e: React.FormEvent) {
    e.preventDefault();
    if (!result) return;
    await upsertContact({
      peerId: result.id,
      shortCode: result.shortCode,
      displayName: result.displayName,
      localAlias: localAlias.trim() || null,
      updatedAt: Date.now(),
    });
  }

  return (
    <div className="mt-2">
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setScanOpen(true)}
          className="rounded-lg border border-[var(--tg-border)] bg-[var(--tg-sidebar)] px-4 py-2 text-[14px] font-medium text-[var(--tg-text)] hover:bg-[var(--tg-hover)]"
        >
          {t("addPage.scanQr")}
        </button>
      </div>
      <QrScanModal open={scanOpen} onClose={() => setScanOpen(false)} />
      <form onSubmit={lookup} className="flex flex-col gap-3 sm:flex-row">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={t("addPage.codePlaceholder")}
          className="flex-1 rounded-lg border border-[var(--tg-border)] bg-white px-3 py-2 font-mono text-[14px] tracking-wider outline-none focus:ring-2 focus:ring-[var(--tg-accent)]"
          maxLength={16}
        />
        <button
          type="submit"
          disabled={loading || code.length < 4}
          className="rounded-lg bg-[var(--tg-accent)] px-6 py-2 text-[14px] font-medium text-white disabled:opacity-50"
        >
          {loading ? "…" : t("addPage.find")}
        </button>
      </form>
      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {result && (
        <div className="mt-6 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-sidebar)] p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--tg-text-secondary)]">
            {t("addPage.foundUser")}
          </p>
          <p className="mt-2 font-mono text-lg text-[var(--tg-text)]">{result.shortCode}</p>
          {result.displayName && (
            <p className="mt-1 text-[14px] text-[var(--tg-text)]">{result.displayName}</p>
          )}
          <form onSubmit={saveAlias} className="mt-4 border-t border-[var(--tg-border)] pt-4">
            <label className="text-[11px] text-[var(--tg-text-secondary)]">
              {t("addPage.aliasLabel")}
            </label>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <input
                value={localAlias}
                onChange={(e) => setLocalAlias(e.target.value)}
                placeholder={t("addPage.aliasPlaceholder")}
                className="max-w-full flex-1 rounded-lg border border-[var(--tg-border)] bg-white px-3 py-2 text-[14px]"
                maxLength={64}
              />
              <button
                type="submit"
                className="rounded-lg border border-[var(--tg-border)] bg-[var(--tg-main)] px-4 py-2 text-[13px] font-medium text-[var(--tg-text)] hover:bg-[var(--tg-hover)]"
              >
                {t("addPage.saveAlias")}
              </button>
            </div>
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/chats/dm/${result.id}`}
              className="inline-flex rounded-lg bg-[var(--tg-accent)] px-4 py-2 text-[14px] font-medium text-white hover:opacity-90"
            >
              {t("addPage.write")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
