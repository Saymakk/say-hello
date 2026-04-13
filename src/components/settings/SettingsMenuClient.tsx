"use client";

import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { EmergencyLocalData } from "@/components/EmergencyLocalData";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { MessagePrivacySettings } from "@/components/MessagePrivacySettings";
import { MessageStorageInfo } from "@/components/MessageStorageInfo";
import { PasskeySettings } from "@/components/PasskeySettings";
import { PasswordChangeForm } from "@/components/PasswordChangeForm";
import { PwaInstallHint } from "@/components/PwaInstallHint";
import { ProfileNickForm } from "@/components/ProfileNickForm";
import { SettingsIntro } from "@/components/SettingsIntro";
import { ShareIdentity } from "@/components/ShareIdentity";
import { GuideContent } from "./GuideContent";
import { SettingsModalShell } from "./SettingsModalShell";

type ModalId =
  | "guide"
  | "language"
  | "nick"
  | "privacy"
  | "password"
  | "passkey"
  | "pwa"
  | "local"
  | "storage"
  | null;

type Props = {
  phone: string;
  addUrl: string;
  displayName: string | null;
  messageEditWindowMinutes: number;
  passkeyCount: number;
};

function isStandaloneClient(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

function MenuRow({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--tg-border)] bg-[var(--tg-sidebar)] px-3 py-2.5 text-left text-[14px] text-[var(--tg-text)] transition hover:bg-[var(--tg-hover)] active:bg-[var(--tg-hover)]"
    >
      <span>{label}</span>
      <span className="shrink-0 text-[var(--tg-text-secondary)]" aria-hidden>
        ›
      </span>
    </button>
  );
}

export function SettingsMenuClient({
  phone,
  addUrl,
  displayName,
  messageEditWindowMinutes,
  passkeyCount,
}: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalId>(null);
  const [pwaMenuVisible, setPwaMenuVisible] = useState(true);

  useEffect(() => {
    setPwaMenuVisible(!isStandaloneClient());
  }, []);

  function close() {
    setModal(null);
  }

  return (
    <>
      <SettingsIntro />
      <div className="mb-3 rounded-lg border border-[var(--tg-border)] bg-[var(--tg-sidebar)] p-3">
        <ShareIdentity phone={phone} addUrl={addUrl} />
      </div>

      <div className="space-y-1.5">
        <MenuRow label="Гайд по возможностям" onClick={() => setModal("guide")} />
        <MenuRow label="Язык" onClick={() => setModal("language")} />
        <MenuRow label="Ник" onClick={() => setModal("nick")} />
        <MenuRow
          label="Приватность сообщений"
          onClick={() => setModal("privacy")}
        />
        <MenuRow label="Смена пароля" onClick={() => setModal("password")} />
        <MenuRow label="Face ID / отпечаток (passkey)" onClick={() => setModal("passkey")} />
        {pwaMenuVisible && (
          <MenuRow label="Установить приложение" onClick={() => setModal("pwa")} />
        )}
        <MenuRow label="Локальные данные" onClick={() => setModal("local")} />
        <MenuRow label="Как сохраняются сообщения" onClick={() => setModal("storage")} />
      </div>
      <div className="mt-3">
        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[14px] font-medium text-red-700 transition hover:bg-red-100 active:bg-red-100 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
        >
          Выйти из аккаунта
        </button>
      </div>

      <SettingsModalShell open={modal === "guide"} title="Гайд" onClose={close}>
        <GuideContent />
      </SettingsModalShell>

      <SettingsModalShell open={modal === "language"} title="Язык" onClose={close}>
        <LanguageSwitcher variant="modal" />
      </SettingsModalShell>

      <SettingsModalShell open={modal === "nick"} title="Ник" onClose={close}>
        <ProfileNickForm
          variant="modal"
          initialDisplayName={displayName}
          onSaved={() => router.refresh()}
        />
      </SettingsModalShell>

      <SettingsModalShell
        open={modal === "privacy"}
        title="Приватность сообщений"
        onClose={close}
      >
        <MessagePrivacySettings
          variant="modal"
          initialWindowMinutes={messageEditWindowMinutes}
        />
      </SettingsModalShell>

      <SettingsModalShell open={modal === "password"} title="Смена пароля" onClose={close}>
        <PasswordChangeForm variant="modal" />
      </SettingsModalShell>

      <SettingsModalShell
        open={modal === "passkey"}
        title="Вход по Face ID / отпечатку"
        onClose={close}
      >
        <PasskeySettings variant="modal" initialPasskeyCount={passkeyCount} />
      </SettingsModalShell>

      <SettingsModalShell open={modal === "pwa"} title="Установить приложение" onClose={close}>
        <PwaInstallHint variant="modal" />
      </SettingsModalShell>

      <SettingsModalShell open={modal === "local"} title="Локальные данные" onClose={close}>
        <EmergencyLocalData variant="modal" />
      </SettingsModalShell>

      <SettingsModalShell
        open={modal === "storage"}
        title="Как сохраняются сообщения"
        onClose={close}
      >
        <MessageStorageInfo variant="modal" />
      </SettingsModalShell>
    </>
  );
}
