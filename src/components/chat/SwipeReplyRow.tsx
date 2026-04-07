"use client";

import { useRef, useState, type ReactNode } from "react";

const THRESH = 56;

/** Свайп слева направо (от правого края) или влево: при достаточном смещении — ответ. */
export function SwipeReplyRow({
  children,
  onReply,
  enabled,
}: {
  children: ReactNode;
  onReply: () => void;
  enabled: boolean;
}) {
  const startX = useRef<number | null>(null);
  const [dx, setDx] = useState(0);

  if (!enabled) return <>{children}</>;

  function endSwipe() {
    if (Math.abs(dx) >= THRESH) onReply();
    setDx(0);
    startX.current = null;
  }

  return (
    <div
      className="w-fit max-w-full min-w-0 shrink-0"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        startX.current = e.clientX;
      }}
      onPointerMove={(e) => {
        if (startX.current === null) return;
        const d = e.clientX - startX.current;
        if (d < 0) setDx(Math.max(d, -96));
        else setDx(0);
      }}
      onPointerUp={endSwipe}
      onPointerCancel={endSwipe}
      onPointerLeave={(e) => {
        if (e.buttons === 0) endSwipe();
      }}
    >
      <div
        style={{ transform: `translateX(${dx}px)` }}
        className="min-w-0 max-w-full transition-transform will-change-transform"
      >
        {children}
      </div>
    </div>
  );
}
