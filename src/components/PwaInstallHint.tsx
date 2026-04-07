"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Событие Chromium до показа системного диалога установки PWA. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "say-hello-pwa-hint-dismissed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return true;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

/** Карточка в настройках: установка PWA (скрывается в уже установленном режиме). */
export function PwaInstallHint() {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [iosLike, setIosLike] = useState(false);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(DISMISS_KEY) === "1") {
      setDismissed(true);
    }
    if (isStandalone()) return;

    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    if (isIos) {
      setIosLike(true);
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      deferredRef.current = e as BeforeInstallPromptEvent;
      setCanPrompt(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  const dismiss = useCallback(() => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }, []);

  const install = useCallback(async () => {
    const ev = deferredRef.current;
    if (!ev) return;
    await ev.prompt();
    await ev.userChoice;
    deferredRef.current = null;
    setCanPrompt(false);
  }, []);

  if (!mounted || isStandalone() || dismissed) {
    return null;
  }

  if (canPrompt) {
    return (
      <div className="mt-6 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-accent-soft)] p-5">
        <h2 className="text-[14px] font-medium text-[var(--tg-text)]">
          Установить как приложение
        </h2>
        <p className="mt-1 text-[12px] leading-snug text-[var(--tg-text-secondary)]">
          Добавьте Say Hello на рабочий стол или в меню приложений — быстрее открытие и удобнее на
          телефоне.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void install()}
            className="rounded-lg bg-[var(--tg-accent)] px-4 py-2 text-[13px] font-medium text-white"
          >
            Установить
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg px-3 py-2 text-[13px] text-[var(--tg-text-secondary)] hover:bg-[var(--tg-hover)]"
          >
            Не сейчас
          </button>
        </div>
      </div>
    );
  }

  if (iosLike) {
    return (
      <div className="mt-6 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-sidebar)] p-5">
        <h2 className="text-[14px] font-medium text-[var(--tg-text)]">
          Установить на экран «Домой»
        </h2>
        <p className="mt-1 text-[12px] leading-snug text-[var(--tg-text-secondary)]">
          На iPhone или iPad: кнопка «Поделиться» в браузере → «На экран Домой». Откроется как
          отдельное приложение.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="mt-3 rounded-lg px-3 py-2 text-[13px] text-[var(--tg-text-secondary)] hover:bg-[var(--tg-hover)]"
        >
          Понятно
        </button>
      </div>
    );
  }

  return null;
}
