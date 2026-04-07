"use client";

import { useRef, useState, type ReactNode } from "react";

const REVEAL = 88;

/** Свайп справа налево — появляется «Удалить»; отпускание на красной зоне или длинный свайп — подтверждение. */
export function SwipeDeleteChatRow({
  children,
  onDelete,
  disabled,
}: {
  children: ReactNode;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const startX = useRef<number | null>(null);
  const [dx, setDx] = useState(0);

  if (disabled) return <>{children}</>;

  function reset() {
    setDx(0);
    startX.current = null;
  }

  function endSwipe() {
    if (dx <= -REVEAL) {
      if (window.confirm("Удалить чат с устройства? История исчезнет локально.")) {
        onDelete();
      }
    }
    reset();
  }

  return (
    <div className="relative w-full overflow-hidden rounded-xl">
      <div
        className="absolute right-0 top-0 flex h-full w-[5.5rem] items-center justify-center bg-red-600 text-[13px] font-medium text-white"
        role="presentation"
      >
        Удалить
      </div>
      <div
        className="relative z-[1] w-full bg-[var(--tg-main)]"
        style={{ transform: `translateX(${dx}px)` }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          startX.current = e.clientX;
        }}
        onPointerMove={(e) => {
          if (startX.current === null) return;
          const d = e.clientX - startX.current;
          if (d < 0) setDx(Math.max(d, -REVEAL - 8));
          else setDx(0);
        }}
        onPointerUp={endSwipe}
        onPointerCancel={reset}
      >
        {children}
      </div>
    </div>
  );
}
