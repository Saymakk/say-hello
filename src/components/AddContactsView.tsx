"use client";

import Link from "next/link";
import { AddByCodeClient } from "@/components/AddByCodeClient";
import { MainHeader } from "@/components/telegram/MainHeader";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export function AddContactsView({ initialCode }: { initialCode: string }) {
  const { t } = useLocale();
  return (
    <>
      <MainHeader titleKey="addPage.title" subtitleKey="addPage.subtitle" />
      <div className="tg-scroll flex-1 overflow-y-auto px-4 py-4">
        <p className="mb-4 text-[14px] text-[var(--tg-text-secondary)]">{t("addPage.intro")}</p>
        <AddByCodeClient initialCode={initialCode} />
        <p className="mt-8 text-center text-[13px] text-[var(--tg-text-secondary)]">
          {t("addPage.groupsHintBefore")}
          <Link href="/chats" className="font-medium text-[var(--tg-accent)] hover:underline">
            {t("addPage.groupsLink")}
          </Link>
          {t("addPage.groupsHintAfter")}
        </p>
      </div>
    </>
  );
}
