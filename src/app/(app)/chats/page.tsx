import { ChatListPanel } from "@/components/chat/ChatListPanel";
import { MainHeader } from "@/components/telegram/MainHeader";

export default function ChatsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <div className="flex min-h-0 w-full shrink-0 md:max-w-[360px]">
        <ChatListPanel />
      </div>
      <div className="hidden min-h-0 flex-1 flex-col border-l border-[var(--tg-border)] md:flex">
        <MainHeader title="Чаты" subtitle="Выберите диалог слева или в меню" />
        <div className="tg-scroll flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-12 text-center">
          <div className="max-w-sm">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--tg-search-bg)] text-[var(--tg-text-secondary)]">
              <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25">
                <path d="M21 12a8 8 0 01-8 8H9l-5 3v-3a8 8 0 118-8z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-[15px] font-medium text-[var(--tg-text)]">Выберите чат</p>
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--tg-text-secondary)]">
              Личные сообщения идут напрямую между устройствами (WebRTC). Если собеседник офлайн,
              доставка возможна только когда оба в сети.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
