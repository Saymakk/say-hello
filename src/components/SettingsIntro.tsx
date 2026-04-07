"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";

export function SettingsIntro() {
  const { t } = useLocale();
  return (
    <p className="mb-4 text-[14px] text-[var(--tg-text-secondary)]">{t("settings.intro")}</p>
  );
}
