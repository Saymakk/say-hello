"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";

export function SettingsIntro() {
  const { t } = useLocale();
  return (
    <p className="mb-2 text-[13px] leading-snug text-[var(--tg-text-secondary)]">
      {t("settings.intro")}
    </p>
  );
}
