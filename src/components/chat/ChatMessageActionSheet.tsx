"use client";

import { useLayoutEffect, useState } from "react";

export type ChatMessageAction = {
  key: string;
  label: string;
  destructive?: boolean;
  onClick: () => void;
};

type Props = {
  open: boolean;
  /** Прямоугольник пузырька сообщения в координатах viewport. */
  anchorRect: DOMRect | null;
  onClose: () => void;
  actions: ChatMessageAction[];
};

/** Меню действий над выбранным сообщением (долгое нажатие / ПКМ). */
export function ChatMessageActionSheet({
  open,
  anchorRect,
  onClose,
  actions,
}: Props) {
  const [style, setStyle] = useState<React.CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRect || actions.length === 0) {
      setStyle(null);
      return;
    }
    const pad = 8;
    const maxW = Math.min(288, typeof window !== "undefined" ? window.innerWidth - 2 * pad : 288);
    const cx = anchorRect.left + anchorRect.width / 2;
    const leftPx = Math.max(
      pad + maxW / 2,
      Math.min(
        cx,
        (typeof window !== "undefined" ? window.innerWidth : cx) - pad - maxW / 2
      )
    );
    const topPx = anchorRect.top - pad;
    setStyle({
      position: "fixed",
      left: leftPx,
      top: topPx,
      transform: "translate(-50%, -100%)",
      maxWidth: `min(18rem, calc(100vw - ${2 * pad}px))`,
      zIndex: 90,
    });
  }, [open, anchorRect, actions.length]);

  if (!open || actions.length === 0 || !anchorRect || !style) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[85] bg-black/25"
        role="presentation"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="rounded-xl border border-[var(--tg-border)] bg-[var(--tg-main)] p-1.5 shadow-xl"
        style={style}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-w-[12rem] flex-col gap-0.5">
          {actions.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => {
                a.onClick();
                onClose();
              }}
              className={`rounded-lg px-3 py-2.5 text-left text-[14px] font-medium ${
                a.destructive
                  ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                  : "text-[var(--tg-text)] hover:bg-[var(--tg-hover)]"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
