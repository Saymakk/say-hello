"use client";

import { useState } from "react";
import { ChatListPanel } from "@/components/chat/ChatListPanel";
import { ComposeDmModal } from "@/components/chat/ComposeDmModal";
import { CreateGroupModal } from "@/components/groups/CreateGroupModal";
import { QrScanModal } from "@/components/QrScanModal";

export function ChatsPageClient() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col md:max-w-2xl">
        <ChatListPanel />
      </div>

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="fixed right-3 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--tg-accent)] text-white shadow-md transition hover:opacity-95 active:scale-95 bottom-[max(0.75rem,calc(3.75rem+env(safe-area-inset-bottom,0px)+0.35rem))] md:bottom-5 md:right-5"
        title="Новый чат"
        aria-label="Новый чат"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {sheetOpen && (
        <div
          className="fixed inset-0 z-[58] flex items-end justify-center bg-black/45 p-3 md:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="chats-fab-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSheetOpen(false);
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[var(--tg-border)] bg-[var(--tg-main)] p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="chats-fab-title" className="text-[15px] font-semibold text-[var(--tg-text)]">
              Новый чат
            </h2>
            <p className="mt-1 text-[12px] text-[var(--tg-text-secondary)]">
              По номеру, QR или создайте группу — всё в одном месте.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setSheetOpen(false);
                  setComposeOpen(true);
                }}
                className="rounded-xl bg-[var(--tg-accent)] px-4 py-3 text-left text-[14px] font-medium text-white"
              >
                Написать по номеру
              </button>
              <button
                type="button"
                onClick={() => {
                  setSheetOpen(false);
                  setQrOpen(true);
                }}
                className="rounded-xl border border-[var(--tg-border)] bg-[var(--tg-sidebar)] px-4 py-3 text-left text-[14px] font-medium text-[var(--tg-text)] hover:bg-[var(--tg-hover)]"
              >
                Сканировать QR
              </button>
              <button
                type="button"
                onClick={() => {
                  setSheetOpen(false);
                  setGroupOpen(true);
                }}
                className="rounded-xl border border-[var(--tg-border)] bg-[var(--tg-sidebar)] px-4 py-3 text-left text-[14px] font-medium text-[var(--tg-text)] hover:bg-[var(--tg-hover)]"
              >
                Новая группа
              </button>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="rounded-lg py-2 text-center text-[13px] text-[var(--tg-text-secondary)] hover:bg-[var(--tg-hover)]"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {composeOpen && <ComposeDmModal onClose={() => setComposeOpen(false)} />}
      <QrScanModal open={qrOpen} onClose={() => setQrOpen(false)} />
      <CreateGroupModal open={groupOpen} onClose={() => setGroupOpen(false)} />
    </div>
  );
}
