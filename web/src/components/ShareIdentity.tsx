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
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[var(--ring)]">
        <QRCode value={addUrl} size={180} level="M" />
      </div>
      <div className="max-w-sm text-center sm:text-left">
        <p className="text-sm font-medium text-[var(--muted)]">Ваш код</p>
        <p className="mt-1 font-mono text-3xl font-semibold tracking-widest text-[var(--foreground)]">
          {shortCode}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          Поделитесь кодом или QR — собеседник откроет страницу добавления и сможет
          пригласить вас в группу или связаться после появления чата.
        </p>
      </div>
    </div>
  );
}
