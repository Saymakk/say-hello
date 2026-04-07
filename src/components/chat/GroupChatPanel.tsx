"use client";

import { useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChatMessageActionSheet,
  type ChatMessageAction,
} from "@/components/chat/ChatMessageActionSheet";
import { useChatObfuscation } from "@/components/ChatObfuscationProvider";
import {
  applyGroupSignals,
  sendGroupDeleteSignal,
  sendGroupEditSignal,
  sendGroupImageSignal,
  sendGroupRequestKeySignal,
  sendGroupTextSignal,
} from "@/lib/chat/group-signal-sync";
import {
  getGroupMessagesLocal,
  saveGroupMessagesCache,
  type GroupMessageLocalRow,
} from "@/lib/chat/local-db";
import {
  buildChatRenderItems,
  formatDaySeparatorLabel,
  formatMinuteGroupLabel,
} from "@/lib/chat/message-time";
import { setGroupLastReadMs } from "@/lib/chat/read-state";
import { SwipeReplyRow } from "@/components/chat/SwipeReplyRow";

function notifyInboxRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("say-hello-inbox-refresh"));
  }
}

type Row = {
  id: string;
  body: string;
  imageDataUrl: string | null;
  createdAt: string;
  editedAt?: string | null;
  userId: string;
  shortCode: string;
  displayName: string | null;
};

function toCacheRows(
  list: GroupMessageLocalRow[]
): Omit<GroupMessageLocalRow, "groupId">[] {
  return list.map((r) => ({
    id: r.id,
    body: r.body,
    imageDataUrl: r.imageDataUrl,
    createdAt: r.createdAt,
    editedAt: r.editedAt ?? null,
    userId: r.userId,
    shortCode: r.shortCode,
    displayName: r.displayName,
  }));
}

function replySnippetRow(m: Row): string {
  if (m.imageDataUrl) return "Фото";
  const b = m.body.trim();
  if (b && b !== " ") return b.length > 120 ? `${b.slice(0, 120)}…` : b;
  return "Сообщение";
}

export function GroupChatPanel({
  groupId,
  className = "",
}: {
  groupId: string;
  className?: string;
}) {
  const { data: session, status } = useSession();
  const { maskText, obfuscateEnabled } = useChatObfuscation();
  const selfId = session?.user?.id;
  const [rows, setRows] = useState<Row[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [messageEditWindowMinutes, setMessageEditWindowMinutes] = useState(30);
  const [replyTo, setReplyTo] = useState<Row | null>(null);
  const [actionMessage, setActionMessage] = useState<Row | null>(null);
  const [actionAnchorRect, setActionAnchorRect] = useState<DOMRect | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [meInfo, setMeInfo] = useState<{
    shortCode: string;
    displayName: string | null;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerDownTargetRef = useRef<HTMLElement | null>(null);
  const suppressBubbleClickRef = useRef(false);

  const chatRenderItems = useMemo(
    () => buildChatRenderItems(rows, (m) => new Date(m.createdAt).getTime()),
    [rows]
  );

  function openMessageActions(m: Row, rect: DOMRect | null) {
    setActionMessage(m);
    setActionAnchorRect(rect);
  }

  function closeMessageActions() {
    setActionMessage(null);
    setActionAnchorRect(null);
  }
  const relaySinceRef = useRef<Date>(new Date(Date.now() - 120_000));
  const seenSignalIdsRef = useRef<Set<string>>(new Set());

  function clearLongPressTimer() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  async function loadLocal() {
    const cached = await getGroupMessagesLocal(groupId);
    setRows(
      cached.map((c) => ({
        id: c.id,
        body: c.body,
        imageDataUrl: c.imageDataUrl,
        createdAt: c.createdAt,
        editedAt: c.editedAt ?? null,
        userId: c.userId,
        shortCode: c.shortCode,
        displayName: c.displayName,
      }))
    );
  }

  useEffect(() => {
    void loadLocal();
  }, [groupId]);

  useEffect(() => {
    if (status !== "authenticated") return;
    void (async () => {
      const res = await fetch("/api/me", { credentials: "include" });
      if (!res.ok) return;
      const j = (await res.json()) as {
        shortCode?: string;
        displayName?: string | null;
        messageEditWindowMinutes?: number;
      };
      if (typeof j.shortCode === "string") {
        setMeInfo({
          shortCode: j.shortCode,
          displayName: j.displayName ?? null,
        });
      }
      if (typeof j.messageEditWindowMinutes === "number") {
        setMessageEditWindowMinutes(j.messageEditWindowMinutes);
      }
    })();
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated" || !selfId) return;
    void sendGroupRequestKeySignal(groupId);
  }, [status, selfId, groupId]);

  useEffect(() => {
    if (status !== "authenticated" || !selfId) return;
    const id = setInterval(async () => {
      try {
        const params = new URLSearchParams();
        params.set("since", relaySinceRef.current.toISOString());
        const res = await fetch(`/api/signals?${params}`, { credentials: "include" });
        if (!res.ok) return;
        const packets = (await res.json()) as {
          id: string;
          fromUserId: string;
          payload: string;
          groupId: string | null;
          createdAt: string;
        }[];
        let maxT = relaySinceRef.current;
        for (const p of packets) {
          const t = new Date(p.createdAt);
          if (t > maxT) maxT = t;
        }
        const changed = await applyGroupSignals(
          groupId,
          packets,
          seenSignalIdsRef.current
        );
        relaySinceRef.current = maxT;
        if (changed) await loadLocal();
      } catch {
        /* */
      }
    }, 2000);
    return () => clearInterval(id);
  }, [status, selfId, groupId]);

  function withinEditWindow(createdAt: string) {
    const t = new Date(createdAt).getTime();
    return Date.now() - t <= Math.max(1, messageEditWindowMinutes) * 60_000;
  }

  useEffect(() => {
    if (!selectionMode) return;
    const winMs = Math.max(1, messageEditWindowMinutes) * 60_000;
    const prune = () => {
      setSelectedIds((prev) => {
        const next = new Set<string>();
        for (const id of prev) {
          const m = rows.find((r) => r.id === id);
          if (
            m &&
            m.userId === selfId &&
            Date.now() - new Date(m.createdAt).getTime() <= winMs
          ) {
            next.add(id);
          }
        }
        if (prev.size === next.size && [...prev].every((id) => next.has(id))) {
          return prev;
        }
        return next;
      });
    };
    prune();
    const t = window.setInterval(prune, 60_000);
    return () => window.clearInterval(t);
  }, [rows, selectionMode, messageEditWindowMinutes, selfId]);

  async function editMine(m: Row) {
    const next = window.prompt("Новый текст", m.body.trim() || "");
    if (next === null) return;
    const tNext = next.trim();
    if (!tNext && !m.imageDataUrl) return;
    setSending(true);
    try {
      await sendGroupEditSignal({
        groupId,
        msgId: m.id,
        body: tNext || " ",
        editedAt: new Date().toISOString(),
      });
      const list = await getGroupMessagesLocal(groupId);
      const nextRows = list.map((r) =>
        r.id === m.id
          ? { ...r, body: tNext || " ", editedAt: new Date().toISOString() }
          : r
      );
      await saveGroupMessagesCache(groupId, toCacheRows(nextRows));
      await loadLocal();
      notifyInboxRefresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Ошибка");
    }
    setSending(false);
  }

  async function deleteMine(m: Row, opts?: { skipConfirm?: boolean }) {
    if (!opts?.skipConfirm && !window.confirm("Удалить сообщение для всех в группе?")) {
      return;
    }
    setSending(true);
    try {
      await sendGroupDeleteSignal({ groupId, msgId: m.id });
      const list = await getGroupMessagesLocal(groupId);
      const nextRows = list.filter((r) => r.id !== m.id);
      await saveGroupMessagesCache(groupId, toCacheRows(nextRows));
      await loadLocal();
      notifyInboxRefresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Ошибка");
    }
    setSending(false);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function exitSelection() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  async function deleteSelectedMessages() {
    const eligible = [...selectedIds]
      .map((id) => rows.find((r) => r.id === id))
      .filter((x): x is Row => !!x)
      .filter((x) => x.userId === selfId && withinEditWindow(x.createdAt));
    if (eligible.length === 0) return;
    if (
      !window.confirm(
        `Удалить ${eligible.length} сообщ. для всех в группе?`
      )
    ) {
      return;
    }
    for (const x of eligible) {
      await deleteMine(x, { skipConfirm: true });
    }
    exitSelection();
  }

  function actionsForMessage(m: Row): ChatMessageAction[] {
    const mine = m.userId === selfId;
    const actions: ChatMessageAction[] = [];
    actions.push({
      key: "reply",
      label: "Ответить",
      onClick: () => setReplyTo(m),
    });
    if (mine && withinEditWindow(m.createdAt)) {
      if (!m.imageDataUrl) {
        actions.push({
          key: "edit",
          label: "Правка",
          onClick: () => void editMine(m),
        });
      }
      actions.push({
        key: "del",
        label: "Удалить",
        destructive: true,
        onClick: () => void deleteMine(m),
      });
      actions.push({
        key: "sel",
        label: "Выбрать",
        onClick: () => {
          setSelectionMode(true);
          setSelectedIds(new Set([m.id]));
        },
      });
    }
    return actions;
  }

  function bubblePointerHandlers(m: Row) {
    return {
      onPointerDown: (e: React.PointerEvent) => {
        if (selectionMode) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;
        pointerDownTargetRef.current = e.currentTarget as HTMLElement;
        clearLongPressTimer();
        longPressTimerRef.current = setTimeout(() => {
          longPressTimerRef.current = null;
          if (actionsForMessage(m).length === 0) return;
          suppressBubbleClickRef.current = true;
          window.setTimeout(() => {
            suppressBubbleClickRef.current = false;
          }, 450);
          const el = pointerDownTargetRef.current;
          openMessageActions(m, el?.getBoundingClientRect() ?? null);
        }, 550);
      },
      onPointerUp: () => clearLongPressTimer(),
      onPointerCancel: () => clearLongPressTimer(),
      onPointerLeave: () => clearLongPressTimer(),
      onContextMenu: (e: React.MouseEvent) => {
        e.preventDefault();
        if (!selectionMode && actionsForMessage(m).length > 0) {
          openMessageActions(m, (e.currentTarget as HTMLElement).getBoundingClientRect());
        }
      },
    };
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [rows.length]);

  useEffect(() => {
    if (rows.length === 0) {
      setGroupLastReadMs(groupId, Date.now());
      return;
    }
    const last = rows[rows.length - 1]!;
    setGroupLastReadMs(groupId, new Date(last.createdAt).getTime());
  }, [groupId, rows]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || sending || !selfId || !meInfo) return;
    const replyPrefix = replyTo ? `> ${replySnippetRow(replyTo)}\n\n` : "";
    const full = replyPrefix + t;
    setSending(true);
    try {
      const msgId = crypto.randomUUID();
      const createdAt = Date.now();
      await sendGroupTextSignal({
        groupId,
        msgId,
        body: full,
        createdAt,
        userId: selfId,
        shortCode: meInfo.shortCode,
        displayName: meInfo.displayName,
      });
      const list = await getGroupMessagesLocal(groupId);
      const newRow: GroupMessageLocalRow = {
        id: msgId,
        groupId,
        body: full,
        imageDataUrl: null,
        createdAt: new Date(createdAt).toISOString(),
        editedAt: null,
        userId: selfId,
        shortCode: meInfo.shortCode,
        displayName: meInfo.displayName,
      };
      const merged = [...list.filter((x) => x.id !== msgId), newRow].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      await saveGroupMessagesCache(groupId, toCacheRows(merged));
      setText("");
      setReplyTo(null);
      await loadLocal();
      notifyInboxRefresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Ошибка отправки");
    }
    setSending(false);
  }

  async function sendImage(f: File | null) {
    if (!f || sending || !selfId || !meInfo) return;
    if (!f.type.startsWith("image/")) return;
    const b64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const s = String(r.result);
        const i = s.indexOf("base64,");
        resolve(i >= 0 ? s.slice(i + 7) : "");
      };
      r.onerror = () => reject(new Error("read"));
      r.readAsDataURL(f);
    });
    if (b64.length > 520_000) return;
    const mime =
      f.type === "image/png"
        ? "image/png"
        : f.type === "image/webp"
          ? "image/webp"
          : f.type === "image/gif"
            ? "image/gif"
            : "image/jpeg";
    const cap = text.trim();
    const replyPrefix = replyTo ? `> ${replySnippetRow(replyTo)}\n\n` : "";
    const combined = `${replyPrefix}${cap}`;
    const caption = combined.trim() ? combined : " ";
    const dataUrl = `data:${mime};base64,${b64}`;
    setSending(true);
    try {
      const msgId = crypto.randomUUID();
      const createdAt = Date.now();
      await sendGroupImageSignal({
        groupId,
        msgId,
        body: caption,
        imageDataUrl: dataUrl,
        createdAt,
        userId: selfId,
        shortCode: meInfo.shortCode,
        displayName: meInfo.displayName,
      });
      const list = await getGroupMessagesLocal(groupId);
      const newRow: GroupMessageLocalRow = {
        id: msgId,
        groupId,
        body: caption,
        imageDataUrl: dataUrl,
        createdAt: new Date(createdAt).toISOString(),
        editedAt: null,
        userId: selfId,
        shortCode: meInfo.shortCode,
        displayName: meInfo.displayName,
      };
      const merged = [...list.filter((x) => x.id !== msgId), newRow].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      await saveGroupMessagesCache(groupId, toCacheRows(merged));
      setText("");
      setReplyTo(null);
      await loadLocal();
      notifyInboxRefresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Ошибка отправки");
    }
    setSending(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  if (status === "loading") {
    return (
      <div
        className={`flex flex-1 items-center justify-center py-4 text-[13px] text-[var(--tg-text-secondary)] ${className}`}
      >
        Загрузка…
      </div>
    );
  }

  return (
    <div
      className={`chat-panel-shell flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--tg-border)] bg-[var(--tg-sidebar)] ${className}`}
    >
      {selectionMode && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--tg-border)] bg-[var(--tg-search-bg)] px-2 py-2">
          <span className="text-[13px] text-[var(--tg-text)]">
            Выбрано: {selectedIds.size}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exitSelection}
              className="rounded-lg px-2 py-1.5 text-[13px] text-[var(--tg-text-secondary)] hover:bg-[var(--tg-hover)]"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={() => void deleteSelectedMessages()}
              className="rounded-lg bg-red-600 px-2 py-1.5 text-[13px] font-medium text-white disabled:opacity-40"
            >
              Удалить
            </button>
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        className="tg-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden"
      >
        <div className="mt-auto flex flex-col gap-2 px-2 py-2 sm:px-3">
          {chatRenderItems.map((block) => {
            if (block.kind === "day") {
              return (
                <div key={`day-${block.dayStart}`} className="flex justify-center py-2">
                  <span className="rounded-sm bg-[var(--tg-search-bg)] px-2 py-1 text-[11px] text-[var(--tg-text-secondary)]">
                    {formatDaySeparatorLabel(block.dayStart)}
                  </span>
                </div>
              );
            }
            return (
              <div
                key={`mg-${block.timeMs}-${block.messages[0]?.id ?? ""}`}
                className="flex flex-col gap-0.5"
              >
                <div className="flex justify-center pb-0.5 pt-0">
                  <span className="text-[11px] tabular-nums text-[var(--tg-text-secondary)]">
                    {formatMinuteGroupLabel(block.timeMs)}
                  </span>
                </div>
                {block.messages.map((m) => {
                  const mine = m.userId === selfId;
                  const sender =
                    mine && meInfo
                      ? meInfo.displayName?.trim() || meInfo.shortCode || "Вы"
                      : mine
                        ? "Вы"
                        : m.displayName?.trim() || m.shortCode;
                  return (
                    <div
                      key={m.id}
                      className={`flex w-full min-w-0 ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`flex w-fit max-w-full min-w-0 flex-col gap-1 ${mine ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-full text-[11px] font-medium text-[var(--tg-text-secondary)] ${
                            mine ? "text-right" : "text-left"
                          }`}
                        >
                          {sender}
                        </div>
                        <SwipeReplyRow enabled={!selectionMode} onReply={() => setReplyTo(m)}>
                          <div
                            className={`flex w-fit max-w-full min-w-0 flex-col gap-2 rounded-sm border p-3 text-left text-[14px] leading-snug select-none overflow-hidden ${
                              mine
                                ? "border-[var(--tg-accent)] bg-[var(--tg-accent)] text-white"
                                : "border-[var(--tg-border)] bg-[var(--tg-search-bg)] text-[var(--tg-text)]"
                            } ${
                              selectionMode &&
                              selectedIds.has(m.id) &&
                              mine &&
                              withinEditWindow(m.createdAt)
                                ? "ring-2 ring-[var(--tg-accent)] ring-offset-2 ring-offset-[var(--tg-sidebar)]"
                                : ""
                            } ${
                              selectionMode && mine && withinEditWindow(m.createdAt)
                                ? "cursor-pointer"
                                : ""
                            }`}
                            {...bubblePointerHandlers(m)}
                            onDoubleClick={(e) => {
                              e.preventDefault();
                              if (selectionMode) return;
                              if (suppressBubbleClickRef.current) return;
                              if (!meInfo) return;
                              setReplyTo(m);
                            }}
                            onClick={() => {
                              if (!selectionMode) return;
                              if (suppressBubbleClickRef.current) return;
                              if (!mine || !withinEditWindow(m.createdAt)) return;
                              toggleSelect(m.id);
                            }}
                          >
                            {m.imageDataUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={m.imageDataUrl}
                                alt=""
                                className={`max-h-64 max-w-full rounded-sm object-contain ${obfuscateEnabled ? "blur-xl" : ""}`}
                              />
                            )}
                            {m.body.trim() && m.body !== " " ? (
                              <span className="break-words">{maskText(m.body)}</span>
                            ) : null}
                            {m.editedAt ? (
                              <span
                                className={`text-[10px] ${mine ? "text-white/70" : "opacity-70"}`}
                              >
                                изм.
                              </span>
                            ) : null}
                          </div>
                        </SwipeReplyRow>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <form
        onSubmit={send}
        className="flex shrink-0 flex-col gap-1 border-t border-[var(--tg-border)] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] md:pb-2"
      >
        {replyTo && (
          <div className="flex items-center gap-2 rounded-lg border border-[var(--tg-border)] bg-[var(--tg-main)] px-2 py-1.5">
            <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--tg-text-secondary)]">
              ↩ {replySnippetRow(replyTo)}
            </span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="shrink-0 rounded p-1 text-[15px] leading-none text-[var(--tg-text-secondary)] hover:bg-[var(--tg-hover)]"
              aria-label="Отменить ответ"
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void sendImage(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            disabled={sending}
            onClick={() => fileRef.current?.click()}
            className="shrink-0 rounded-lg border border-[var(--tg-border)] px-2 py-2 text-[13px] hover:bg-[var(--tg-hover)] disabled:opacity-40"
            title="Фото"
          >
            📷
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Сообщение или подпись к фото…"
            className="min-w-0 flex-1 rounded-lg border border-[var(--tg-border)] bg-white px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-[var(--tg-accent)]"
            maxLength={8000}
          />
          <button
            type="submit"
            disabled={!text.trim() || sending || !meInfo}
            className="shrink-0 rounded-lg bg-[var(--tg-accent)] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-40"
          >
            Отпр.
          </button>
        </div>
      </form>

      <ChatMessageActionSheet
        open={Boolean(actionMessage)}
        anchorRect={actionAnchorRect}
        onClose={closeMessageActions}
        actions={actionMessage ? actionsForMessage(actionMessage) : []}
      />
    </div>
  );
}
