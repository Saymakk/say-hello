"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type Tab = {
  href: string;
  labelKey: string;
  icon: "chat" | "group" | "contact" | "settings";
};

const tabs: Tab[] = [
  { href: "/chats", labelKey: "nav.chats", icon: "chat" },
  { href: "/add", labelKey: "nav.contacts", icon: "contact" },
  { href: "/settings", labelKey: "nav.profileTab", icon: "settings" },
];

function TabIcon({ name, active }: { name: Tab["icon"]; active: boolean }) {
  const cls = active ? "text-[var(--tg-accent)]" : "text-[var(--tg-text-secondary)]";
  const common = "h-6 w-6";
  switch (name) {
    case "chat":
      return (
        <svg className={`${common} ${cls}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M21 12a8 8 0 01-8 8H9l-5 3v-3a8 8 0 118-8z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "group":
      return (
        <svg className={`${common} ${cls}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M17 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "contact":
      return (
        <svg className={`${common} ${cls}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M12 7a4 4 0 100-8 4 4 0 000 8zM20 8v6M23 11h-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "settings":
      return (
        <svg className={`${common} ${cls}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/chats") {
    return (
      pathname === "/chats" ||
      pathname.startsWith("/chats/") ||
      pathname.startsWith("/groups/")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Нижняя навигация как в нативных приложениях (только &lt; md). */
export function BottomTabBar() {
  const { t } = useLocale();
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-[var(--tg-border)] bg-[var(--tg-sidebar)]/95 backdrop-blur-md md:hidden"
      style={{
        paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))",
      }}
      aria-label="Основное меню"
    >
      <ul className="flex w-full items-stretch justify-between gap-0 px-1 pt-1">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <li key={tab.href} className="min-w-0 flex-1">
              <Link
                href={tab.href}
                className={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 transition-colors active:bg-[var(--tg-hover)] ${
                  active ? "text-[var(--tg-accent)]" : "text-[var(--tg-text-secondary)]"
                }`}
              >
                <TabIcon name={tab.icon} active={active} />
                <span
                  className={`max-w-full truncate px-0.5 text-[10px] font-medium leading-tight ${
                    active ? "text-[var(--tg-accent)]" : "text-[var(--tg-text-secondary)]"
                  }`}
                >
                  {t(tab.labelKey)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
