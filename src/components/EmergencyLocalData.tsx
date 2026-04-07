"use client";

import { useRef, useState } from "react";
import {
  clearAllLocalChatData,
  exportLocalChatDump,
  importLocalChatDump,
} from "@/lib/chat/local-db";

export function EmergencyLocalData() {
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
    const dump = await exportLocalChatDump();
    const blob = new Blob([JSON.stringify(dump, null, 0)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `say-hello-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg("Файл дампа сохранён.");
  }

  async function onImportFile(f: File | null) {
    if (!f) return;
    setMsg(null);
    try {
      const text = await f.text();
      const data = JSON.parse(text);
      const mode: "merge" | "replace" = confirm(
        "Заменить все текущие локальные данные содержимым файла? «Отмена» — только объединить (контакты и сообщения добавятся к существующим)."
      )
        ? "replace"
        : "merge";
      await importLocalChatDump(data, mode);
      setMsg("Импорт выполнен. Обновите страницу.");
    } catch {
      setMsg("Не удалось прочитать файл.");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <section className="mt-8 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-sidebar)] p-5">
      <h2 className="text-[14px] font-medium text-[var(--tg-text)]">Локальные данные</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--tg-text-secondary)]">
        Резервная копия и очистка относятся только к этому браузеру (IndexedDB). Серверные группы и
        аккаунт не затрагиваются.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
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
