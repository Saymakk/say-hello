"use client";

import { useRef, useState } from "react";
import {
  decryptDumpObject,
  encryptDumpObject,
  isEncryptedDumpEnvelope,
} from "@/lib/crypto/dump-encrypt";
import {
  clearAllLocalChatData,
  exportLocalChatDump,
  importLocalChatDump,
} from "@/lib/chat/local-db";

type Props = { variant?: "page" | "modal" };

export function EmergencyLocalData({ variant = "page" }: Props) {
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onWipe() {
    if (
      !confirm(
        "Удалить на этом устройстве все локальные диалоги, контакты и ключи шифрования? Действие необратимо."
      )
    ) {
      return;
    }
    await clearAllLocalChatData();
    setMsg("Локальные данные удалены. Обновите страницу.");
  }

  async function onExport() {
    const pw = window.prompt(
      "Задайте пароль для шифрования дампа (не меньше 8 символов). Без него восстановить данные будет нельзя."
    );
    if (!pw || pw.length < 8) {
      setMsg(pw ? "Пароль слишком короткий." : "Экспорт отменён.");
      return;
    }
    const pw2 = window.prompt("Повторите пароль:");
    if (pw !== pw2) {
      setMsg("Пароли не совпали.");
      return;
    }
    setMsg(null);
    const dump = await exportLocalChatDump();
    const encrypted = await encryptDumpObject(dump, pw);
    const blob = new Blob([JSON.stringify(encrypted, null, 0)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `say-hello-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg("Зашифрованный файл сохранён. Тексты в нём нечитаемы без пароля и импорта в приложение.");
  }

  async function onImportFile(f: File | null) {
    if (!f) return;
    setMsg(null);
    try {
      const text = await f.text();
      const raw = JSON.parse(text) as unknown;
      let data: unknown = raw;
      if (isEncryptedDumpEnvelope(raw)) {
        const pw = window.prompt("Пароль от зашифрованного дампа:");
        if (!pw) {
          setMsg("Импорт отменён.");
          if (fileRef.current) fileRef.current.value = "";
          return;
        }
        data = await decryptDumpObject(raw, pw);
      }
      const mode: "merge" | "replace" = confirm(
        "Заменить все текущие локальные данные содержимым файла? «Отмена» — только объединить (контакты и сообщения добавятся к существующим)."
      )
        ? "replace"
        : "merge";
      await importLocalChatDump(data, mode);
      setMsg("Импорт выполнен. Обновите страницу.");
    } catch (e) {
      setMsg(
        e instanceof Error ? e.message : "Не удалось прочитать или расшифровать файл."
      );
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  const shell =
    variant === "modal"
      ? "mt-0 rounded-lg border-0 bg-transparent p-0"
      : "mt-3 rounded-lg border border-[var(--tg-border)] bg-[var(--tg-sidebar)] p-3";

  return (
    <section className={shell}>
      {variant === "page" && (
        <h2 className="text-[13px] font-medium text-[var(--tg-text)]">Локальные данные</h2>
      )}
      <p
        className={`text-[12px] leading-snug text-[var(--tg-text-secondary)] ${variant === "page" ? "mt-1.5" : "mt-0"}`}
      >
        Резервная копия и очистка относятся только к этому браузеру (IndexedDB). Серверные группы и
        аккаунт не затрагиваются.
      </p>
      <p className="mt-2 text-[12px] leading-snug text-[var(--tg-text-secondary)]">
        <span className="font-medium text-[var(--tg-text)]">Что в дампе:</span> контакты (коды, ники,
        локальные подписи), все личные сообщения из IndexedDB, кэш групповых сообщений для офлайна и{" "}
        <span className="font-medium text-[var(--tg-text)]">приватный ключ E2E</span> (если был создан)
        вместе с публичным — то есть всё, что нужно для расшифровки сохранённой переписки на этом
        устройстве.
      </p>
      <p className="mt-2 text-[12px] leading-snug text-[var(--tg-text-secondary)]">
        <span className="font-medium text-[var(--tg-text)]">Шифрование:</span> при экспорте задаётся
        пароль; в файле хранится только соль и шифротекст (AES-GCM). Переписка и ключи становятся
        читаемыми только после импорта в этом приложении с тем же паролем. Старые незашифрованные дампы
        (v2) по-прежнему можно импортировать.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void onExport()}
          className="rounded-lg border border-[var(--tg-border)] bg-[var(--tg-main)] px-3 py-2 text-[13px] font-medium text-[var(--tg-text)] hover:bg-[var(--tg-hover)]"
        >
          Скачать дамп
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-lg border border-[var(--tg-border)] bg-[var(--tg-main)] px-3 py-2 text-[13px] font-medium text-[var(--tg-text)] hover:bg-[var(--tg-hover)]"
        >
          Загрузить дамп
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => void onImportFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => void onWipe()}
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-800 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
        >
          Удалить все переписки локально
        </button>
      </div>
      {msg && (
        <p className="mt-3 text-[13px] text-[var(--tg-text-secondary)]" role="status">
          {msg}
        </p>
      )}
    </section>
  );
}
