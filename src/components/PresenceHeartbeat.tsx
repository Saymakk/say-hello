"use client";

import { useEffect } from "react";

/** Раз в минуту сообщает серверу об активности (для индикатора онлайн у контактов). */
export function PresenceHeartbeat() {
  useEffect(() => {
    const ping = () => {
      void fetch("/api/presence", { method: "POST", credentials: "include" });
    };
    void ping();
    const id = setInterval(ping, 60_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void ping();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return null;
}
