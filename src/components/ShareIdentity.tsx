"use client";

import QRCode from "react-qr-code";

type Props = {
  shortCode: string;
  addUrl: string;
};

/** QR и текст кода для обмена контактами (без email в QR — только ссылка на /add). */
export function ShareIdentity({ shortCode, addUrl }: Props) {
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-center">
      <div className="rounded-xl border border-[var(--tg-border)] bg-white p-4">
        <QRCode value={addUrl} size={180} level="M" />
      </div>
      <div className="max-w-sm text-center sm:text-left">
        <p className="text-[13px] font-medium text-[var(--tg-text-secondary)]">Ваш код</p>
        <p className="mt-1 font-mono text-3xl font-semibold tracking-widest text-[var(--tg-text)]">
          {shortCode}
        </p>
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--tg-text-secondary)]">
          Поделитесь кодом или QR — собеседник откроет страницу добавления и сможет
          пригласить вас в группу или связаться после появления чата.
        </p>
      </div>
    </div>
  );
}
