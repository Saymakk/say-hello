"use client";

import { useEffect, useMemo, useState } from "react";

/** Периодически запрашивает онлайн-статус по списку peer id. */
export function usePeerPresence(peerIds: string[]) {
  const [online, setOnline] = useState<Record<string, boolean>>({});
  const key = useMemo(() => [...peerIds].sort().join(","), [peerIds]);

  useEffect(() => {
    if (!key) {
      setOnline({});
      return;
    }

    let cancelled = false;
    const load = async () => {
      const res = await fetch(
        `/api/peers/presence?ids=${encodeURIComponent(key)}`,
        { credentials: "include" }
      );
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { online?: Record<string, boolean> };
      if (!cancelled) setOnline(data.online ?? {});
    };

    void load();
    const id = setInterval(load, 45_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [key]);

  return online;
}
