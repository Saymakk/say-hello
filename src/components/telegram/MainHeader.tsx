type Props = {
  title: string;
  subtitle?: string;
};

/** Верхняя полоса как в окне чата Telegram. */
export function MainHeader({ title, subtitle }: Props) {
  return (
    <header className="flex h-[3.25rem] shrink-0 items-center border-b border-[var(--tg-border)] bg-[var(--tg-header)] px-4">
      <div className="min-w-0">
        <h1 className="truncate text-[15px] font-semibold text-[var(--tg-text)]">{title}</h1>
        {subtitle ? (
          <p className="truncate text-[13px] text-[var(--tg-text-secondary)]">{subtitle}</p>
        ) : null}
      </div>
    </header>
  );
}
