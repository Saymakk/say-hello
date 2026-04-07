import { AppShellClient } from "@/components/telegram/AppShellClient";

/**
 * Десктоп: слева сайдбар. Мобильный: нижняя tab-bar; отступ снизу под неё + safe-area.
 */
export default function AppSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-[100dvh] max-h-[100dvh] w-full overflow-hidden bg-[var(--tg-bg)]">
      <AppShellClient />
      <div className="app-main-tight flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--tg-main)] pb-[calc(3.75rem+env(safe-area-inset-bottom,0px))] md:pb-0">
        {children}
      </div>
    </div>
  );
}
