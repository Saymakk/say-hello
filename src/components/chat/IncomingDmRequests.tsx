"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { notifyInboxAndSidebarRefresh } from "@/lib/chat/inbox-events";
import { upsertContact } from "@/lib/chat/local-db";

type Row = {
  id: string;
  createdAt: string;
  firstMessagePreview: string | null;
  from: {
    id: string;
    shortCode: string;
    displayName: string | null;
  };
};

export function IncomingDmRequests() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/dm/requests/incoming", { credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json()) as Row[];
    setRows(data);
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(load, 12_000);
    return () => clearInterval(id);
  }, [load]);

  async function accept(r: Row) {
    setBusy(r.id);
    const res = await fetch(`/api/dm/requests/${r.id}/accept`, {
      method: "POST",
      credentials: "include",
    });
    setBusy(null);
    if (res.ok) {
      await upsertContact({
        peerId: r.from.id,
        shortCode: r.from.shortCode,
        displayName: r.from.displayName,
        updatedAt: Date.now(),
      });
      notifyInboxAndSidebarRefresh();
      await load();
      router.refresh();
    }
  }

  async function decline(requestId: string) {
    setBusy(requestId);
    await fetch(`/api/dm/requests/${requestId}/decline`, {
      method: "POST",
      credentials: "include",
    });
    setBusy(null);
    void load();
    router.refresh();
  }

  if (rows.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-2 z-[55] flex flex-col items-center gap-2 px-3">
      {rows.map((r) => (
        <div
          key={r.id}
          className="pointer-events-auto w-full max-w-md rounded-xl border border-[var(--tg-border)] bg-[var(--tg-main)] p-3 shadow-lg"
        >
          <p className="text-[13px] font-medium text-[var(--tg-text)]">
            {r.from.displayName || r.from.shortCode} хочет с вами общаться
          </p>
          <p className="mt-0.5 font-mono text-[12px] text-[var(--tg-text-secondary)]">
            {r.from.shortCode}
          </p>
          {r.firstMessagePreview && (
            <p className="mt-2 line-clamp-2 text-[13px] text-[var(--tg-text-secondary)]">
              «{r.firstMessagePreview}»
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy === r.id}
              onClick={() => void accept(r)}
              className="rounded-lg bg-[var(--tg-accent)] px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
            >
              Принять
            </button>
            <button
              type="button"
              disabled={busy === r.id}
              onClick={() => void decline(r.id)}
              className="rounded-lg border border-[var(--tg-border)] px-3 py-1.5 text-[13px] text-[var(--tg-text)] disabled:opacity-50"
            >
              Отклонить
            </button>
            <Link
              href={`/chats/dm/${r.from.id}`}
              className="rounded-lg px-3 py-1.5 text-[13px] text-[var(--tg-accent)] hover:underline"
            >
              Открыть чат
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
