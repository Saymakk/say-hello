"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  clearUnlockSuccessCount,
  incrementUnlockSuccessCount,
  obfuscateChatText,
  readObfuscateEnabled,
  readUnlockSuccessCount,
  writeObfuscateEnabled,
} from "@/lib/chat/obfuscate-display";

type Ctx = {
  obfuscateEnabled: boolean;
  setObfuscateEnabled: (on: boolean) => void;
  /** Текст для баблов; картинки обрабатывайте отдельно (blur). */
  maskText: (plain: string) => string;
  unlockSuccessCount: number;
  tryUnlockWithPassword: (password: string) => Promise<{
    ok: boolean;
    restored?: boolean;
    successStreak?: number;
  }>;
};

const ChatObfuscationContext = createContext<Ctx | null>(null);

export function ChatObfuscationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [obfuscateEnabled, setState] = useState(false);
  const [unlockSuccessCount, setUnlockCount] = useState(0);

  useEffect(() => {
    setState(readObfuscateEnabled());
    setUnlockCount(readUnlockSuccessCount());
    const h = () => {
      setState(readObfuscateEnabled());
      setUnlockCount(readUnlockSuccessCount());
    };
    window.addEventListener("say-hello-obfuscate-changed", h);
    return () => window.removeEventListener("say-hello-obfuscate-changed", h);
  }, []);

  const setObfuscateEnabled = useCallback((on: boolean) => {
    writeObfuscateEnabled(on);
    clearUnlockSuccessCount();
    setUnlockCount(0);
    setState(on);
  }, []);

  const maskText = useCallback(
    (plain: string) => (obfuscateEnabled ? obfuscateChatText(plain) : plain),
    [obfuscateEnabled]
  );

  const tryUnlockWithPassword = useCallback(async (password: string) => {
    const res = await fetch("/api/me/verify-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ password }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
    if (!res.ok || !data.ok) return { ok: false };
    const n = incrementUnlockSuccessCount();
    setUnlockCount(n);
    if (n >= 3) {
      writeObfuscateEnabled(false);
      clearUnlockSuccessCount();
      setUnlockCount(0);
      setState(false);
      return { ok: true, restored: true, successStreak: 0 };
    }
    return { ok: true, successStreak: n };
  }, []);

  const value = useMemo(
    () => ({
      obfuscateEnabled,
      setObfuscateEnabled,
      maskText,
      unlockSuccessCount,
      tryUnlockWithPassword,
    }),
    [
      obfuscateEnabled,
      setObfuscateEnabled,
      maskText,
      unlockSuccessCount,
      tryUnlockWithPassword,
    ]
  );

  return (
    <ChatObfuscationContext.Provider value={value}>
      {children}
    </ChatObfuscationContext.Provider>
  );
}

export function useChatObfuscation() {
  const ctx = useContext(ChatObfuscationContext);
  if (!ctx) {
    throw new Error("useChatObfuscation outside provider");
  }
  return ctx;
}
