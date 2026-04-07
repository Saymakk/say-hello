"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AddMemberForm } from "@/components/AddMemberForm";
import { GroupChatPanel } from "@/components/chat/GroupChatPanel";
import { deleteGroupMessagesLocal } from "@/lib/chat/local-db";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export type GroupMemberRow = {
  userId: string;
  role: string;
  shortCode: string;
  displayName: string | null;
};

export function GroupDetailClient({
  groupId,
  groupName,
  isAdmin,
  currentUserId,
  members,
}: {
  groupId: string;
  groupName: string;
  isAdmin: boolean;
  currentUserId: string;
  members: GroupMemberRow[];
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function deleteGroupGlobally() {
    if (!confirm(t("groups.deleteConfirm"))) return;
    setDeleting(true);
    const res = await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      await deleteGroupMessagesLocal(groupId);
      router.push("/groups");
      router.refresh();
    }
  }

  return (
    <div className="chat-panel-shell mx-auto flex min-h-0 w-full max-w-[44rem] flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-2 border-b border-[var(--tg-border)] bg-[var(--tg-header)] px-2 py-2 md:px-4">
        <Link
          href="/groups"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--tg-accent)] md:hidden"
          aria-label="Back"
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <button
          type="button"
          onClick={() => setDetailsOpen((v) => !v)}
          className="min-w-0 flex-1 rounded-lg px-1 py-1 text-left transition hover:bg-[var(--tg-hover)] md:px-2"
        >
          <div className="flex items-center gap-1">
            <h1 className="truncate text-[15px] font-semibold text-[var(--tg-text)]">{groupName}</h1>
            <span className="shrink-0 text-[var(--tg-text-secondary)]" aria-hidden>
              {detailsOpen ? "▾" : "▸"}
            </span>
          </div>
          <p className="truncate text-[12px] text-[var(--tg-text-secondary)]">
            {isAdmin ? t("groups.admin") : t("groups.member")} · {t("groups.tapForMembers")}
          </p>
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-2 pt-2 md:px-4">
        <GroupChatPanel groupId={groupId} className="min-h-0 flex-1" />

        {detailsOpen && (
          <div className="tg-scroll mt-3 max-h-[min(45vh,420px)] shrink-0 space-y-6 overflow-y-auto border-t border-[var(--tg-border)] pt-4">
            {isAdmin && <AddMemberForm groupId={groupId} />}
            <section>
              <h2 className="mb-2 text-[13px] font-medium uppercase tracking-wide text-[var(--tg-text-secondary)]">
                {t("groups.participants")}
              </h2>
              <ul className="rounded-xl border border-[var(--tg-border)]">
                {members.map((m) => (
                  <li
                    key={m.userId}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--tg-border)] px-3 py-3 text-[14px] last:border-0"
                  >
                    <span className="font-mono text-[13px]">{m.shortCode}</span>
                    <span className="text-right text-[13px] text-[var(--tg-text-secondary)]">
                      {m.displayName ?? "—"} ·{" "}
                      {m.role === "admin" ? t("groups.adminRole") : t("groups.memberRole")}
                    </span>
                    {m.userId !== currentUserId && (
                      <Link
                        href={`/chats/dm/${m.userId}`}
                        className="w-full text-[13px] text-[var(--tg-accent)] hover:underline sm:w-auto"
                      >
                        {t("groups.dmLink")}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
            {isAdmin && (
              <section className="border-t border-[var(--tg-border)] pt-4">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => void deleteGroupGlobally()}
                  className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-[14px] font-medium text-red-800 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
                >
                  {t("groups.deleteChat")}
                </button>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
