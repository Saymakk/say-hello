"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { Locale } from "@/lib/i18n/dictionaries";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();

  return (
    <div className="mt-6 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-sidebar)] p-5">
      <h2 className="text-[14px] font-medium text-[var(--tg-text)]">{t("settings.language")}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["ru", "en"] as Locale[]).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLocale(l)}
            className={`rounded-lg border px-4 py-2 text-[14px] font-medium transition ${
              locale === l
                ? "border-[var(--tg-accent)] bg-[var(--tg-accent-soft)] text-[var(--tg-accent)]"
                : "border-[var(--tg-border)] bg-[var(--tg-main)] text-[var(--tg-text)] hover:bg-[var(--tg-hover)]"
            }`}
          >
            {l === "ru" ? t("settings.langRu") : t("settings.langEn")}
          </button>
        ))}
      </div>
    </div>
  );
}
