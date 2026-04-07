"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";

type Props = {
  title?: string;
  subtitle?: string;
  titleKey?: string;
  subtitleKey?: string;
};

/** Верхняя полоса как в окне чата Telegram. */
export function MainHeader({ title, subtitle, titleKey, subtitleKey }: Props) {
  const { t } = useLocale();
  const displayTitle = titleKey ? t(titleKey) : (title ?? "");
  const displaySubtitle = subtitleKey ? t(subtitleKey) : subtitle;

  return (
    <header className="flex h-[3.25rem] shrink-0 items-center border-b border-[var(--tg-border)] bg-[var(--tg-header)] px-4">
      <div className="min-w-0">
        <h1 className="truncate text-[15px] font-semibold text-[var(--tg-text)]">{displayTitle}</h1>
        {displaySubtitle ? (
          <p className="truncate text-[13px] text-[var(--tg-text-secondary)]">{displaySubtitle}</p>
        ) : null}
      </div>
    </header>
  );
}
