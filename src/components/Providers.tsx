"use client";

import { SessionProvider } from "next-auth/react";
import { ChatObfuscationProvider } from "@/components/ChatObfuscationProvider";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LocaleProvider>
        <ChatObfuscationProvider>{children}</ChatObfuscationProvider>
      </LocaleProvider>
    </SessionProvider>
  );
}
