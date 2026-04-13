"use client";

import QRCode from "react-qr-code";
import { useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type Props = {
  phone: string;
  addUrl: string;
};

/** QR и текст кода для обмена контактами (без email в QR — только ссылка на /add). */
export function ShareIdentity({ phone, addUrl }: Props) {
  const { t } = useLocale();
  const [shareHint, setShareHint] = useState<string | null>(null);

  async function shareContact() {
    setShareHint(null);
    const text = `Телефон: ${phone}\n${addUrl}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: t("share.shareTitle"),
          text,
          url: addUrl,
        });
        return;
      } catch {
        /* отмена или ошибка */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareHint(t("share.copied"));
    } catch {
      setShareHint(t("share.copyFailed"));
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-center">
      <div className="rounded-lg border border-[var(--tg-border)] bg-white p-3">
        <QRCode value={addUrl} size={160} level="M" />
      </div>
      <div className="max-w-sm text-center sm:text-left">
        <p className="text-[13px] font-medium text-[var(--tg-text-secondary)]">Ваш номер</p>
        <p className="mt-1 font-mono text-2xl font-semibold tracking-widest text-[var(--tg-text)]">
          {phone}
        </p>
        <p className="mt-2 text-[12px] leading-snug text-[var(--tg-text-secondary)]">
          {t("share.qrHint")}
        </p>
        <button
          type="button"
          onClick={() => void shareContact()}
          className="mt-3 w-full rounded-lg bg-[var(--tg-accent)] px-3 py-2 text-[13px] font-medium text-white sm:w-auto"
        >
          {t("share.shareContact")}
        </button>
        {shareHint && (
          <p className="mt-2 text-[12px] text-[var(--tg-text-secondary)]">{shareHint}</p>
        )}
      </div>
    </div>
  );
}
