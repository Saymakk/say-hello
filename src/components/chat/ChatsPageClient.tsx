"use client";

import { useState } from "react";
import { ChatListPanel } from "@/components/chat/ChatListPanel";
import { ComposeDmModal } from "@/components/chat/ComposeDmModal";

export function ChatsPageClient() {
  const [composeOpen, setComposeOpen] = useState(false);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col md:max-w-2xl">
        <ChatListPanel />
      </div>

      <button
        type="button"
        onClick={() => setComposeOpen(true)}
        className="fixed right-3 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--tg-accent)] text-white shadow-md transition hover:opacity-95 active:scale-95 bottom-[max(0.75rem,calc(3.75rem+env(safe-area-inset-bottom,0px)+0.35rem))] md:bottom-5 md:right-5"
        title="Написать"
        aria-label="Написать"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {composeOpen && <ComposeDmModal onClose={() => setComposeOpen(false)} />}
    </div>
  );
}
