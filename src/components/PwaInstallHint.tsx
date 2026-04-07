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

type Props = { variant?: "page" | "modal" };

/** Карточка в настройках: установка PWA (скрывается в уже установленном режиме). В модалке — всегда есть текст подсказки. */
export function PwaInstallHint({ variant = "page" }: Props) {
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

  const hidePageCard =
    variant === "page" && (!mounted || isStandalone() || dismissed);
  if (hidePageCard) {
    return null;
  }

  if (variant === "modal") {
    if (!mounted) return null;
    if (isStandalone()) {
      return (
        <div className="mt-0 rounded-lg border border-[var(--tg-border)] bg-[var(--tg-sidebar)] p-3">
          <h2 className="text-[14px] font-medium text-[var(--tg-text)]">Приложение</h2>
          <p className="mt-1 text-[12px] leading-snug text-[var(--tg-text-secondary)]">
            Say Hello уже открыт в режиме установленного приложения (отдельное окно или экран «Домой»).
          </p>
        </div>
      );
    }
    if (canPrompt) {
      return (
        <div className="mt-0 rounded-lg border border-[var(--tg-border)] bg-[var(--tg-accent-soft)] p-3">
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
          </div>
        </div>
      );
    }
    if (iosLike) {
      return (
        <div className="mt-0 rounded-lg border border-[var(--tg-border)] bg-[var(--tg-sidebar)] p-3">
          <h2 className="text-[14px] font-medium text-[var(--tg-text)]">
            Установить на экран «Домой»
          </h2>
          <p className="mt-1 text-[12px] leading-snug text-[var(--tg-text-secondary)]">
            На iPhone или iPad: кнопка «Поделиться» в браузере → «На экран Домой». Откроется как
            отдельное приложение.
          </p>
        </div>
      );
    }
    return (
      <div className="mt-0 rounded-lg border border-[var(--tg-border)] bg-[var(--tg-sidebar)] p-3">
        <h2 className="text-[14px] font-medium text-[var(--tg-text)]">Установить как приложение</h2>
        <p className="mt-1 text-[12px] leading-snug text-[var(--tg-text-secondary)]">
          В Chrome или Edge откройте меню браузера (три точки) и выберите «Установить приложение» или
          «Установить Say Hello», если пункт есть. В Firefox PWA может называться «Установить» в меню
          страницы.
        </p>
      </div>
    );
  }

  if (canPrompt) {
    return (
      <div className="mt-3 rounded-lg border border-[var(--tg-border)] bg-[var(--tg-accent-soft)] p-3">
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
      <div className="mt-3 rounded-lg border border-[var(--tg-border)] bg-[var(--tg-sidebar)] p-3">
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
