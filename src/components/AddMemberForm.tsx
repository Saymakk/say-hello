"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { listContacts, type ContactRow } from "@/lib/chat/local-db";

export function AddMemberForm({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [contacts, setContacts] = useState<ContactRow[]>([]);

  useEffect(() => {
    void listContacts().then((rows) => setContacts(rows.slice(0, 30)));
  }, []);

  async function addByPhone(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    const res = await fetch(`/api/groups/${groupId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMessage(typeof data.error === "string" ? data.error : "Ошибка");
      return;
    }
    setPhone("");
    setMessage("Участник добавлен");
    router.refresh();
  }

  async function addContact(c: ContactRow) {
    setMessage(null);
    setLoading(true);
    const res = await fetch(`/api/groups/${groupId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shortCode: c.shortCode }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMessage(typeof data.error === "string" ? data.error : "Ошибка");
      return;
    }
    setMessage("Участник добавлен");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {contacts.length > 0 && (
        <div className="rounded-xl border border-[var(--tg-border)] bg-[var(--tg-sidebar)] p-4">
          <h2 className="text-[14px] font-medium text-[var(--tg-text)]">Недавние контакты</h2>
          <p className="mt-1 text-[12px] text-[var(--tg-text-secondary)]">
            Люди из локального списка (находили по коду или писали ранее на этом устройстве).
          </p>
          <ul className="mt-3 flex flex-col gap-1.5">
            {contacts.map((c) => (
              <li key={c.peerId}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void addContact(c)}
                  className="flex w-full items-center justify-between rounded-lg border border-[var(--tg-border)] bg-[var(--tg-main)] px-3 py-2 text-left text-[13px] transition hover:bg-[var(--tg-hover)] disabled:opacity-50"
                >
                  <span className="truncate font-medium text-[var(--tg-text)]">
                    {c.localAlias?.trim() || c.displayName || c.shortCode}
                  </span>
                  <span className="shrink-0 font-mono text-[12px] text-[var(--tg-text-secondary)]">
                    {c.shortCode}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form
        onSubmit={addByPhone}
        className="rounded-xl border border-[var(--tg-border)] bg-[var(--tg-sidebar)] p-4"
      >
        <h2 className="text-[14px] font-medium text-[var(--tg-text)]">Добавить по номеру</h2>
        <p className="mt-1 text-[12px] text-[var(--tg-text-secondary)]">
          Введите номер телефона человека — он получит роль участника.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Телефон"
            className="flex-1 rounded-lg border border-[var(--tg-border)] bg-white px-3 py-2 font-mono text-[14px] outline-none focus:ring-2 focus:ring-[var(--tg-accent)]"
          />
          <button
            type="submit"
            disabled={loading || phone.trim().length < 10}
            className="rounded-lg bg-[var(--tg-accent)] px-5 py-2 text-[14px] font-medium text-white disabled:opacity-50"
          >
            {loading ? "…" : "Добавить"}
          </button>
        </div>
        {message && (
          <p
            className={`mt-2 text-[12px] ${message.includes("Ошиб") || message.includes("Только") || message.includes("не найден") || message.includes("Уже") ? "text-red-600" : "text-[var(--tg-text-secondary)]"}`}
            role="status"
          >
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
