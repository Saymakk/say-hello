"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { listDmConversations } from "@/lib/chat/local-db";

type NavItem = {
  href: string;
  label: string;
  icon: "chat" | "group" | "contact" | "settings";
};

const nav: NavItem[] = [
  { href: "/chats", label: "Чаты", icon: "chat" },
  { href: "/groups", label: "Группы", icon: "group" },
  { href: "/add", label: "Контакты", icon: "contact" },
  { href: "/settings", label: "Настройки", icon: "settings" },
];

function Icon({ name }: { name: NavItem["icon"] }) {
  const common = "h-[1.35rem] w-[1.35rem] shrink-0";
  switch (name) {
    case "chat":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M21 12a8 8 0 01-8 8H9l-5 3v-3a8 8 0 118-8z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "group":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M17 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "contact":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M12 7a4 4 0 100-8 4 4 0 000 8zM20 8v6M23 11h-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "settings":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [recent, setRecent] = useState<
    Awaited<ReturnType<typeof listDmConversations>>
  >([]);

  useEffect(() => {
    void (async () => {
      const r = await listDmConversations();
      setRecent(r);
    })();
    const handler = () => {
      void listDmConversations().then(setRecent);
    };
    window.addEventListener("say-hello-chat-updated", handler);
    return () => window.removeEventListener("say-hello-chat-updated", handler);
  }, []);

  function active(href: string) {
    if (href === "/chats") {
      return (
        pathname === "/chats" ||
        (pathname?.startsWith("/chats/") ?? false)
      );
    }
    return pathname === href || pathname?.startsWith(`${href}/`);
  }

  return (
    <>
      <div className="flex h-14 items-center px-3">
        <Link
          href="/chats"
          onClick={onNavigate}
          className="truncate text-lg font-semibold tracking-tight text-[var(--tg-accent)]"
        >
          Say Hello
        </Link>
      </div>

      <div className="px-2 pb-2">
        <div className="flex h-9 items-center rounded-lg bg-[var(--tg-search-bg)] px-2.5 text-sm text-[var(--tg-text-secondary)]">
          <svg className="mr-2 h-4 w-4 shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </svg>
          <span className="select-none">Поиск</span>
        </div>
      </div>

      <nav className="tg-scroll flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
        {nav.map((item) => {
          const isActive = active(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[15px] transition-colors ${
                isActive
                  ? "bg-[var(--tg-accent-soft)] text-[var(--tg-accent)]"
                  : "text-[var(--tg-text)] hover:bg-[var(--tg-hover)]"
              }`}
            >
              <span className={isActive ? "text-[var(--tg-accent)]" : "text-[var(--tg-text-secondary)]"}>
                <Icon name={item.icon} />
              </span>
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}

        <div className="my-3 border-t border-[var(--tg-border)] pt-3">
          <p className="px-3 pb-1 text-[13px] font-medium uppercase tracking-wide text-[var(--tg-text-secondary)]">
            Диалоги
          </p>
          {recent.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--tg-border)] px-3 py-4 text-center text-[12px] leading-snug text-[var(--tg-text-secondary)]">
              Личные чаты появятся после первого сообщения
            </div>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {recent.map((c) => (
                <li key={c.peerId}>
                  <Link
                    href={`/chats/dm/${c.peerId}`}
                    onClick={onNavigate}
                    className={`block rounded-[10px] px-3 py-2 text-left transition-colors ${
                      pathname === `/chats/dm/${c.peerId}`
                        ? "bg-[var(--tg-accent-soft)]"
                        : "hover:bg-[var(--tg-hover)]"
                    }`}
                  >
                    <span className="block truncate text-[14px] font-medium text-[var(--tg-text)]">
                      {c.displayName || c.shortCode || c.peerId.slice(0, 8)}
                    </span>
                    <span className="block truncate text-[12px] text-[var(--tg-text-secondary)]">
                      {c.preview}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </nav>

      <div className="border-t border-[var(--tg-border)] p-2">
        <div className="flex items-center gap-2 rounded-lg px-2 py-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--tg-accent)] text-sm font-semibold text-white">
            {(session?.user?.email?.[0] ?? "?").toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium text-[var(--tg-text)]">
              {session?.user?.name || "Профиль"}
            </p>
            <p className="truncate text-[12px] text-[var(--tg-text-secondary)]">
              {session?.user?.email}
            </p>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="shrink-0 rounded-md px-2 py-1.5 text-[13px] text-[var(--tg-text-secondary)] transition hover:bg-[var(--tg-hover)] hover:text-[var(--tg-text)]"
            title="Выйти"
          >
            Выйти
          </button>
        </div>
      </div>
    </>
  );
}
