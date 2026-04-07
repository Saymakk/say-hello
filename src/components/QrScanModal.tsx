"use client";

import { Html5Qrcode } from "html5-qrcode";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { extractInviteCodeFromQrText } from "@/lib/qr/extract-invite-code";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { notifyInboxAndSidebarRefresh } from "@/lib/chat/inbox-events";
import { upsertContact } from "@/lib/chat/local-db";

const READER_ID = "say-hello-qr-reader";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function QrScanModal({ open, onClose }: Props) {
  const { t } = useLocale();
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const stoppingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const stopScanner = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s) {
      try {
        await s.stop();
      } catch {
        /* */
      }
      try {
        s.clear();
      } catch {
        /* */
      }
    }
    stoppingRef.current = false;
  }, []);

  useEffect(() => {
    if (!open) {
      void stopScanner();
      setErr(null);
      return;
    }

    let cancelled = false;
    setErr(null);

    const run = async () => {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      if (cancelled) return;
      try {
        const html5 = new Html5Qrcode(READER_ID);
        scannerRef.current = html5;
        await html5.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          async (decodedText) => {
            const code = extractInviteCodeFromQrText(decodedText);
            if (!code) {
              setErr(t("addPage.scanNoCode"));
              return;
            }
            await stopScanner();
            if (cancelled) return;
            onCloseRef.current();
            const res = await fetch(
              `/api/users/lookup?code=${encodeURIComponent(code)}`
            );
            const data = (await res.json().catch(() => ({}))) as {
              id?: string;
              shortCode?: string;
              displayName?: string | null;
              error?: string;
            };
            if (!res.ok || !data.id) {
              router.push(`/add?c=${encodeURIComponent(code)}`);
              return;
            }
            await upsertContact({
              peerId: data.id,
              shortCode: data.shortCode ?? code,
              displayName: data.displayName ?? null,
              updatedAt: Date.now(),
            });
            notifyInboxAndSidebarRefresh();
            router.push(`/chats/dm/${data.id}`);
          },
          undefined
        );
      } catch {
        if (!cancelled) setErr(t("addPage.scanError"));
      }
    };

    void run();

    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [open, router, stopScanner, t]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t("addPage.scanQr")}
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 rounded-2xl bg-[var(--tg-main)] p-4 shadow-xl">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[15px] font-medium text-[var(--tg-text)]">{t("addPage.scanning")}</p>
          <button
            type="button"
            onClick={() => {
              void stopScanner();
              onClose();
            }}
            className="rounded-lg px-3 py-1.5 text-[14px] text-[var(--tg-accent)] hover:bg-[var(--tg-hover)]"
          >
            {t("addPage.stopScan")}
          </button>
        </div>
        <div
          id={READER_ID}
          className="min-h-[240px] w-full overflow-hidden rounded-xl bg-black"
        />
        {err && (
          <p className="text-center text-[13px] text-red-600" role="alert">
            {err}
          </p>
        )}
      </div>
    </div>
  );
}
