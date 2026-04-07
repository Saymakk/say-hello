"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { useChatObfuscation } from "@/components/ChatObfuscationProvider";
import { OnlineDot } from "@/components/chat/OnlineDot";
import { usePeerPresence } from "@/hooks/usePeerPresence";
import {
  loadUnifiedInboxRows,
  type UnifiedInboxRow,
} from "@/lib/chat/unified-inbox";
import { getDmLastReadMs, getGroupLastReadMs } from "@/lib/chat/read-state";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type NavItem = {
  href: string;
  labelKey: string;
  icon: "chat" | "group" | "contact" | "settings";
};

const nav: NavItem[] = [
  { href: "/chats", labelKey: "nav.chats", icon: "chat" },
  { href: "/groups", labelKey: "nav.groups", icon: "group" },
  { href: "/add", labelKey: "nav.contacts", icon: "contact" },
  { href: "/settings", labelKey: "nav.settings", icon: "settings" },
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
  const { t } = useLocale();
  const { maskText, obfuscateEnabled } = useChatObfuscation();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [recent, setRecent] = useState<UnifiedInboxRow[]>([]);
  const [, setReadTick] = useState(0);

  const refreshRecent = useCallback(() => {
    void loadUnifiedInboxRows().then((r) => setRecent(r.slice(0, 25)));
  }, []);

  const recentDmIds = recent
    .filter((c): c is Extract<UnifiedInboxRow, { kind: "dm" }> => c.kind === "dm")
    .map((c) => c.peerId);
  const presence = usePeerPresence(recentDmIds);

  useEffect(() => {
    void refreshRecent();
  }, [refreshRecent, pathname]);

  useEffect(() => {
    const onChat = () => void refreshRecent();
    const onInbox = () => void refreshRecent();
    window.addEventListener("say-hello-chat-updated", onChat);
    window.addEventListener("say-hello-inbox-refresh", onInbox);
    return () => {
      window.removeEventListener("say-hello-chat-updated", onChat);
      window.removeEventListener("say-hello-inbox-refresh", onInbox);
    };
  }, [refreshRecent]);

  useEffect(() => {
    const h = () => setReadTick((x) => x + 1);
    window.addEventListener("say-hello-read-updated", h);
    return () => window.removeEventListener("say-hello-read-updated", h);
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
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--tg-accent)] hover:bg-[var(--tg-hover)]"
          aria-label={t("nav.brand")}
          title={t("nav.brand")}
        >
          <svg
            className="h-7 w-7"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            aria-hidden
          >
            <path
              d="M21 12a8 8 0 01-8 8H9l-5 3v-3a8 8 0 118-8z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>

      <div className="px-2 pb-2">
        <div className="flex h-9 items-center rounded-lg bg-[var(--tg-search-bg)] px-2.5 text-sm text-[var(--tg-text-secondary)]">
          <svg className="mr-2 h-4 w-4 shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </svg>
          <span className="select-none">{t("nav.search")}</span>
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
              className={`flex items-center gap-3 rounded-[10px] border border-transparent px-3 py-2.5 text-[15px] transition-colors ${
                isActive
                  ? "border-[var(--tg-border)] bg-[var(--tg-accent-soft)] text-[var(--tg-accent)]"
                  : "text-[var(--tg-text)] hover:border-[var(--tg-border)] hover:bg-[var(--tg-hover)]"
              }`}
            >
              <span className={isActive ? "text-[var(--tg-accent)]" : "text-[var(--tg-text-secondary)]"}>
                <Icon name={item.icon} />
              </span>
              <span className="font-medium">{t(item.labelKey)}</span>
            </Link>
          );
        })}

        <div className="my-3 -mx-2 border-t border-[var(--tg-border)] pt-3">
          <p className="px-3 pb-1 text-[13px] font-medium uppercase tracking-wide text-[var(--tg-text-secondary)]">
            {t("nav.recent")}
          </p>
          {recent.length === 0 ? (
            <div className="mx-2 rounded-lg border border-dashed border-[var(--tg-border)] px-3 py-4 text-center text-[12px] leading-snug text-[var(--tg-text-secondary)]">
              {t("sidebar.recentEmpty")}
            </div>
          ) : (
            <ul className="flex flex-col gap-2 px-2">
              {recent.map((c) => {
                if (c.kind === "dm") {
                  const activeDm = pathname === `/chats/dm/${c.peerId}`;
                  const online = presence[c.peerId] ?? false;
                  const unread =
                    c.lastDirection === "in" &&
                    c.lastAt > getDmLastReadMs(c.peerId);
                  return (
                    <li key={`dm-${c.peerId}`}>
                      <Link
                        href={`/chats/dm/${c.peerId}`}
                        onClick={onNavigate}
                        className={`relative flex w-full flex-col gap-1 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-main)] px-3 py-2.5 text-left transition hover:bg-[var(--tg-hover)] ${
                          activeDm ? "ring-1 ring-[var(--tg-accent)]" : ""
                        }`}
                      >
                        {unread && (
                          <span
                            className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[var(--tg-accent)]"
                            aria-hidden
                          />
                        )}
                        <span className="flex w-full items-center justify-between gap-2">
                          <span className="flex min-w-0 flex-1 items-center gap-2 pr-5">
                            <OnlineDot online={online} />
                            <span
                              className={`truncate text-[15px] text-[var(--tg-text)] ${
                                unread ? "font-semibold" : "font-medium"
                              }`}
                            >
                              {c.label}
                            </span>
                          </span>
                          <span className="shrink-0 text-[12px] text-[var(--tg-text-secondary)]">
                            {online ? t("sidebar.online") : t("sidebar.offline")}
                          </span>
                        </span>
                        <span className="block truncate pl-4 text-[12px] text-[var(--tg-text-secondary)]">
                          {obfuscateEnabled ? maskText(c.preview) : c.preview}
                        </span>
                      </Link>
                    </li>
                  );
                }
                const href = `/groups/${c.groupId}`;
                const activeG =
                  pathname === href || pathname.startsWith(`${href}/`);
                const unreadG =
                  !!c.lastMessageAt &&
                  new Date(c.lastMessageAt).getTime() >
                    getGroupLastReadMs(c.groupId);
                return (
                  <li key={`g-${c.groupId}`}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      className={`relative flex w-full flex-col gap-1 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-main)] px-3 py-2.5 text-left transition hover:bg-[var(--tg-hover)] ${
                        activeG ? "ring-1 ring-[var(--tg-accent)]" : ""
                      }`}
                    >
                      {unreadG && (
                        <span
                          className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[var(--tg-accent)]"
                          aria-hidden
                        />
                      )}
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="flex min-w-0 flex-1 items-center gap-2 pr-5">
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--tg-search-bg)] text-[var(--tg-text-secondary)]"
                            aria-hidden
                          >
                            <Icon name="group" />
                          </span>
                          <span
                            className={`truncate text-[15px] text-[var(--tg-text)] ${
                              unreadG ? "font-semibold" : "font-medium"
                            }`}
                          >
                            {c.label}
                          </span>
                        </span>
                        <span className="shrink-0 text-[12px] text-[var(--tg-text-secondary)]">
                          группа
                        </span>
                      </span>
                      <span className="block truncate pl-11 text-[12px] text-[var(--tg-text-secondary)]">
                        {obfuscateEnabled ? maskText(c.preview) : c.preview}
                      </span>
                    </Link>
                  </li>
                );
              })}
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
              {session?.user?.name || t("sidebar.profileFallback")}
            </p>
            <p className="truncate text-[12px] text-[var(--tg-text-secondary)]">
              {session?.user?.email}
            </p>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="shrink-0 rounded-md px-2 py-1.5 text-[13px] text-[var(--tg-text-secondary)] transition hover:bg-[var(--tg-hover)] hover:text-[var(--tg-text)]"
            title={t("common.logout")}
          >
            {t("common.logout")}
          </button>
        </div>
      </div>
    </>
  );
}
