"use client";

import { BottomTabBar } from "./BottomTabBar";
import { SidebarNav } from "./SidebarNav";

/**
 * Десктоп: боковая панель. Мобильный: нижняя панель с иконками (без drawer).
 */
export function AppShellClient() {
  return (
    <>
      <aside className="hidden h-full w-[min(100%,22rem)] shrink-0 flex-col border-r border-[var(--tg-border)] bg-[var(--tg-sidebar)] shadow-[2px_0_8px_rgba(0,0,0,0.04)] md:flex">
        <SidebarNav />
      </aside>
      <BottomTabBar />
    </>
  );
}
