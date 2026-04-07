"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { Locale } from "@/lib/i18n/dictionaries";

type Props = { variant?: "page" | "modal" };

export function LanguageSwitcher({ variant = "page" }: Props) {
  const { locale, setLocale, t } = useLocale();
  const shell =
    variant === "modal"
      ? "mt-0 rounded-lg border-0 bg-transparent p-0"
      : "mt-3 rounded-lg border border-[var(--tg-border)] bg-[var(--tg-sidebar)] p-3";

  return (
    <div className={shell}>
      {variant === "page" && (
        <h2 className="text-[14px] font-medium text-[var(--tg-text)]">{t("settings.language")}</h2>
      )}
      <div className={variant === "modal" ? "flex flex-wrap gap-2" : "mt-3 flex flex-wrap gap-2"}>
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
