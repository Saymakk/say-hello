/** Индикатор: зелёный — недавно в сети, серый — офлайн / неизвестно. */
export function OnlineDot({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${
        online ? "bg-emerald-500" : "bg-[var(--tg-border)]"
      }`}
      title={online ? "В сети" : "Не в сети"}
      aria-hidden
    />
  );
}
