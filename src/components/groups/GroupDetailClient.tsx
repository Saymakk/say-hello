"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AddMemberForm } from "@/components/AddMemberForm";
import { GroupChatPanel } from "@/components/chat/GroupChatPanel";
import { SettingsModalShell } from "@/components/settings/SettingsModalShell";
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
  const [removeBusy, setRemoveBusy] = useState<string | null>(null);

  async function deleteGroupGlobally() {
    if (!confirm(t("groups.deleteConfirm"))) return;
    setDeleting(true);
    const res = await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      await deleteGroupMessagesLocal(groupId);
      router.push("/chats");
      router.refresh();
    }
  }

  async function removeMember(userId: string) {
    const ok = confirm(
      userId === currentUserId
        ? t("groups.leaveGroupConfirm")
        : t("groups.removeFromGroupConfirm")
    );
    if (!ok) return;
    setRemoveBusy(userId);
    const res = await fetch(`/api/groups/${groupId}/members/${userId}`, {
      method: "DELETE",
      credentials: "include",
    });
    setRemoveBusy(null);
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      left?: boolean;
    };
    if (!res.ok) {
      window.alert(data.error ?? "Ошибка");
      return;
    }
    if (data.left) {
      await deleteGroupMessagesLocal(groupId);
      router.push("/chats");
      router.refresh();
      return;
    }
    router.refresh();
  }

  return (
    <div className="chat-panel-shell mx-auto flex min-h-0 w-full max-w-[44rem] flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-2 border-b border-[var(--tg-border)] bg-[var(--tg-header)] px-2 py-2 md:px-4">
        <Link
          href="/chats"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--tg-accent)] md:hidden"
          aria-label="Назад к чатам"
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1 px-1 py-1 md:px-2">
          <h1 className="truncate text-[15px] font-semibold text-[var(--tg-text)]">{groupName}</h1>
          <p className="truncate text-[12px] text-[var(--tg-text-secondary)]">
            {isAdmin ? t("groups.admin") : t("groups.member")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[20px] text-[var(--tg-text-secondary)] hover:bg-[var(--tg-hover)]"
          aria-label={t("groups.tapForMembers")}
          title={t("groups.tapForMembers")}
        >
          ⋯
        </button>
      </header>

      <SettingsModalShell
        open={detailsOpen}
        title={groupName}
        onClose={() => setDetailsOpen(false)}
      >
        <div className="space-y-6">
          {isAdmin && <AddMemberForm groupId={groupId} />}
          <section>
            <h2 className="mb-2 text-[13px] font-medium uppercase tracking-wide text-[var(--tg-text-secondary)]">
              {t("groups.participants")}
            </h2>
            <ul className="rounded-xl border border-[var(--tg-border)]">
              {members.map((m) => (
                <li
                  key={m.userId}
                  className="flex flex-col gap-2 border-b border-[var(--tg-border)] px-3 py-3 text-[14px] last:border-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[13px]">{m.shortCode}</span>
                    <span className="text-right text-[13px] text-[var(--tg-text-secondary)]">
                      {m.displayName ?? "—"} ·{" "}
                      {m.role === "admin" ? t("groups.adminRole") : t("groups.memberRole")}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {m.userId !== currentUserId && (
                      <Link
                        href={`/chats/dm/${m.userId}`}
                        className="text-[13px] text-[var(--tg-accent)] hover:underline"
                      >
                        {t("groups.dmLink")}
                      </Link>
                    )}
                    {isAdmin && m.userId !== currentUserId && (
                      <button
                        type="button"
                        disabled={removeBusy === m.userId}
                        onClick={() => void removeMember(m.userId)}
                        className="rounded-lg border border-[var(--tg-border)] px-2 py-1 text-[12px] text-red-700 hover:bg-[var(--tg-hover)] disabled:opacity-50 dark:text-red-400"
                      >
                        {t("groups.removeFromGroup")}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={removeBusy === currentUserId}
              onClick={() => void removeMember(currentUserId)}
              className="mt-4 w-full rounded-xl border border-[var(--tg-border)] px-4 py-3 text-left text-[14px] text-[var(--tg-text)] transition hover:bg-[var(--tg-hover)] disabled:opacity-50"
            >
              {t("groups.leaveGroup")}
            </button>
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
      </SettingsModalShell>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-2 pt-2 md:px-4">
        <GroupChatPanel groupId={groupId} className="min-h-0 flex-1" />
      </div>
    </div>
  );
}
