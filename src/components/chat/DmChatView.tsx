"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  decryptUtf8,
  deriveSharedAesKey,
  encryptUtf8,
} from "@/lib/crypto/dm-e2e";
import {
  ChatMessageActionSheet,
  type ChatMessageAction,
} from "@/components/chat/ChatMessageActionSheet";
import { SettingsModalShell } from "@/components/settings/SettingsModalShell";
import { SwipeReplyRow } from "@/components/chat/SwipeReplyRow";
import { useChatObfuscation } from "@/components/ChatObfuscationProvider";
import { notifyInboxAndSidebarRefresh } from "@/lib/chat/inbox-events";
import { DirectP2P } from "@/lib/chat/direct-p2p";
import { postDmRelay, type DmRelayPayload } from "@/lib/chat/dm-relay";
import { setDmLastReadMs } from "@/lib/chat/read-state";
import {
  buildChatRenderItems,
  formatDaySeparatorLabel,
  formatMinuteGroupLabel,
} from "@/lib/chat/message-time";
import {
  addDmMessage,
  ensureE2eIdentity,
  getContact,
  getDmMessages,
  patchDmMessageLocal,
  upsertContact,
  type DmMessageRow,
} from "@/lib/chat/local-db";

type Peer = {
  id: string;
  shortCode: string;
  displayName: string | null;
  publicKeyJwk?: string | null;
  dm: {
    canSendDm: boolean;
    blocked: boolean;
    blockedByMe: boolean;
    blockedByThem: boolean;
    incomingRequestId: string | null;
    outgoingPending: boolean;
    outgoingDeclined: boolean;
  };
};

type RelayParsed = {
  kind?: string;
  msgId?: string;
  body?: string;
  ts?: number;
  enc?: boolean;
  c?: string;
  replyToId?: string;
  replySnippet?: string;
};

export function DmChatView({ peerId }: { peerId: string }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { maskText, obfuscateEnabled } = useChatObfuscation();
  const selfId = session?.user?.id;
  const [peer, setPeer] = useState<Peer | null>(null);
  const peerRef = useRef<Peer | null>(null);
  peerRef.current = peer;
  const [peerLoading, setPeerLoading] = useState(true);
  const [messages, setMessages] = useState<DmMessageRow[]>([]);
  const [text, setText] = useState("");
  const [conn, setConn] = useState<string>("connecting");
  const [aliasDraft, setAliasDraft] = useState("");
  const [chatPropsOpen, setChatPropsOpen] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const p2pRef = useRef<DirectP2P | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const relaySinceRef = useRef<Date>(new Date(Date.now() - 120_000));
  const seenMsgIdsRef = useRef<Set<string>>(new Set());
  const [messageEditWindowMinutes, setMessageEditWindowMinutes] = useState(30);
  const [replyTo, setReplyTo] = useState<DmMessageRow | null>(null);
  const [actionMessage, setActionMessage] = useState<DmMessageRow | null>(null);
  const [actionAnchorRect, setActionAnchorRect] = useState<DOMRect | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerDownTargetRef = useRef<HTMLElement | null>(null);
  const suppressBubbleClickRef = useRef(false);

  const chatRenderItems = useMemo(
    () => buildChatRenderItems(messages, (m) => m.createdAt),
    [messages]
  );

  function openMessageActions(m: DmMessageRow, rect: DOMRect | null) {
    setActionMessage(m);
    setActionAnchorRect(rect);
  }

  function closeMessageActions() {
    setActionMessage(null);
    setActionAnchorRect(null);
  }

  function clearLongPressTimer() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function replySnippetFrom(m: DmMessageRow): string {
    if (m.deleted) return "Сообщение удалено";
    if (m.kind === "image") return "Фото";
    const t = m.body.trim();
    return t.length > 120 ? `${t.slice(0, 120)}…` : t;
  }

  const loadPeer = useCallback(async () => {
    const res = await fetch(`/api/peers/${peerId}`);
    if (!res.ok) {
      setPeer(null);
      return;
    }
    const p = (await res.json()) as Peer;
    setPeer(p);
    const local = await getContact(p.id);
    setAliasDraft(local?.localAlias ?? "");
    await upsertContact({
      peerId: p.id,
      shortCode: p.shortCode,
      displayName: p.displayName,
      updatedAt: Date.now(),
    });
  }, [peerId]);

  useEffect(() => {
    void (async () => {
      setPeerLoading(true);
      await loadPeer();
      setPeerLoading(false);
    })();
  }, [loadPeer]);

  useEffect(() => {
    if (status !== "authenticated") return;
    void (async () => {
      const res = await fetch("/api/me", { credentials: "include" });
      if (!res.ok) return;
      const j = (await res.json()) as { messageEditWindowMinutes?: number };
      if (typeof j.messageEditWindowMinutes === "number") {
        setMessageEditWindowMinutes(j.messageEditWindowMinutes);
      }
    })();
  }, [status]);

  /** Публикуем публичный ключ для E2E. */
  useEffect(() => {
    if (status !== "authenticated" || !selfId) return;
    void (async () => {
      try {
        const id = await ensureE2eIdentity();
        await fetch("/api/me", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicKeyJwk: JSON.stringify(id.publicJwk) }),
        });
      } catch {
        /* */
      }
    })();
  }, [status, selfId]);

  useEffect(() => {
    void (async () => {
      const rows = await getDmMessages(peerId);
      setMessages(rows);
      rows.forEach((m) => seenMsgIdsRef.current.add(m.id));
    })();
  }, [peerId]);

  useEffect(() => {
    if (messages.length === 0) {
      setDmLastReadMs(peerId, Date.now());
      return;
    }
    const last = messages[messages.length - 1]!;
    setDmLastReadMs(peerId, last.createdAt);
  }, [peerId, messages]);

  useEffect(() => {
    if (status !== "authenticated" || !selfId || selfId === peerId) return;
    if (!peer || !peer.dm.canSendDm) {
      if (p2pRef.current) {
        p2pRef.current.stop();
        p2pRef.current = null;
      }
      return;
    }

    const p2p = new DirectP2P(
      selfId,
      peerId,
      async (incoming) => {
        if ("legacyText" in incoming) {
          const id = crypto.randomUUID();
          const row: DmMessageRow = {
            id,
            peerId,
            direction: "in",
            body: incoming.legacyText,
            kind: "text",
            createdAt: Date.now(),
          };
          await addDmMessage(row);
          setMessages((m) => [...m, row]);
          return;
        }
        if (incoming.t === "text") {
          const id = crypto.randomUUID();
          const r = "r" in incoming && incoming.r ? incoming.r : undefined;
          const row: DmMessageRow = {
            id,
            peerId,
            direction: "in",
            body: incoming.b,
            kind: "text",
            createdAt: Date.now(),
            ...(r ? { replyToId: r.id, replySnippet: r.s } : {}),
          };
          await addDmMessage(row);
          setMessages((m) => [...m, row]);
          return;
        }
        if (incoming.t === "img") {
          const id = crypto.randomUUID();
          const r = "r" in incoming && incoming.r ? incoming.r : undefined;
          const row: DmMessageRow = {
            id,
            peerId,
            direction: "in",
            body: incoming.b,
            kind: "image",
            createdAt: Date.now(),
            ...(r ? { replyToId: r.id, replySnippet: r.s } : {}),
          };
          await addDmMessage(row);
          setMessages((m) => [...m, row]);
        }
      },
      (s) => setConn(s)
    );
    p2pRef.current = p2p;
    void p2p.start();

    return () => {
      p2p.stop();
      p2pRef.current = null;
    };
  }, [selfId, peerId, status, peer]);

  useEffect(() => {
    if (!peer || peer.dm.canSendDm) return;
    const id = setInterval(() => void loadPeer(), 5000);
    return () => clearInterval(id);
  }, [peer, loadPeer]);

  async function decryptRelayPayload(p: RelayParsed): Promise<string | null> {
    const pub = peerRef.current?.publicKeyJwk;
    if (p.enc && typeof p.c === "string") {
      if (!pub) return null;
      try {
        const ident = await ensureE2eIdentity();
        const peerPub = JSON.parse(pub) as JsonWebKey;
        const aes = await deriveSharedAesKey(ident.privateJwk, peerPub);
        return await decryptUtf8(p.c, aes);
      } catch {
        return null;
      }
    }
    if (typeof p.body === "string") return p.body;
    return null;
  }

  /** Резервная доставка через /api/signals. */
  useEffect(() => {
    if (status !== "authenticated" || !selfId) return;
    const id = setInterval(async () => {
      try {
        const params = new URLSearchParams();
        params.set("since", relaySinceRef.current.toISOString());
        const res = await fetch(`/api/signals?${params}`, { credentials: "include" });
        if (!res.ok) return;
        const rows = (await res.json()) as {
          id: string;
          fromUserId: string;
          payload: string;
          createdAt: string;
        }[];
        let maxT = relaySinceRef.current;
        let accepted = false;
        for (const row of rows) {
          const t = new Date(row.createdAt);
          if (t > maxT) maxT = t;
          if (row.fromUserId !== peerId) continue;
          let p: RelayParsed;
          try {
            p = JSON.parse(row.payload) as RelayParsed;
          } catch {
            continue;
          }
          if (p.kind === "dm-accepted") {
            accepted = true;
            continue;
          }
          if (p.kind === "dm-text-edit") {
            const mid = typeof p.msgId === "string" ? p.msgId : "";
            if (!mid) continue;
            const body = await decryptRelayPayload(p);
            if (body === null) continue;
            const editedAt = Date.now();
            await patchDmMessageLocal(mid, peerId, { body, editedAt });
            setMessages((prev) => {
              const idx = prev.findIndex((x) => x.id === mid);
              if (idx < 0) {
                const row: DmMessageRow = {
                  id: mid,
                  peerId,
                  direction: "in",
                  body,
                  kind: "text",
                  createdAt: typeof p.ts === "number" ? p.ts : t.getTime(),
                  editedAt,
                };
                void addDmMessage(row);
                return [...prev, row];
              }
              return prev.map((x) =>
                x.id === mid ? { ...x, body, editedAt } : x
              );
            });
            continue;
          }
          if (p.kind === "dm-delete") {
            const mid = typeof p.msgId === "string" ? p.msgId : "";
            if (!mid) continue;
            await patchDmMessageLocal(mid, peerId, { deleted: true, body: "" });
            setMessages((prev) =>
              prev.map((x) =>
                x.id === mid ? { ...x, deleted: true, body: "" } : x
              )
            );
            continue;
          }
          if (p.kind !== "dm-text" && p.kind !== "dm-image") continue;
          const mid = typeof p.msgId === "string" ? p.msgId : crypto.randomUUID();
          if (seenMsgIdsRef.current.has(mid)) continue;
          const body = await decryptRelayPayload(p);
          if (body === null) continue;
          seenMsgIdsRef.current.add(mid);
          const kind = p.kind === "dm-image" ? "image" : "text";
          const rf =
            typeof p.replyToId === "string" && typeof p.replySnippet === "string"
              ? { replyToId: p.replyToId, replySnippet: p.replySnippet }
              : {};
          const dm: DmMessageRow = {
            id: mid,
            peerId,
            direction: "in",
            body,
            kind,
            createdAt: typeof p.ts === "number" ? p.ts : t.getTime(),
            ...rf,
          };
          await addDmMessage(dm);
          setMessages((prev) => [...prev, dm]);
        }
        relaySinceRef.current = maxT;
        if (accepted) void loadPeer();
      } catch {
        /* offline */
      }
    }, 2000);
    return () => clearInterval(id);
  }, [selfId, peerId, status, loadPeer]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function buildRelayPayload(
    kind: "dm-text" | "dm-image",
    msgId: string,
    body: string,
    ts: number,
    reply?: { replyToId: string; replySnippet: string }
  ): Promise<DmRelayPayload> {
    const rf = reply
      ? { replyToId: reply.replyToId, replySnippet: reply.replySnippet }
      : {};
    const p = peerRef.current;
    if (p?.publicKeyJwk) {
      try {
        const ident = await ensureE2eIdentity();
        const peerPub = JSON.parse(p.publicKeyJwk) as JsonWebKey;
        const aes = await deriveSharedAesKey(ident.privateJwk, peerPub);
        const c = await encryptUtf8(body, aes);
        return kind === "dm-text"
          ? { kind: "dm-text", msgId, ts, enc: true, c, ...rf }
          : { kind: "dm-image", msgId, ts, enc: true, c, ...rf };
      } catch {
        /* fallback plain */
      }
    }
    return kind === "dm-text"
      ? { kind: "dm-text", msgId, body, ts, ...rf }
      : { kind: "dm-image", msgId, body, ts, ...rf };
  }

  async function buildEditRelayPayload(
    msgId: string,
    body: string,
    ts: number
  ): Promise<DmRelayPayload> {
    const p = peerRef.current;
    if (p?.publicKeyJwk) {
      try {
        const ident = await ensureE2eIdentity();
        const peerPub = JSON.parse(p.publicKeyJwk) as JsonWebKey;
        const aes = await deriveSharedAesKey(ident.privateJwk, peerPub);
        const c = await encryptUtf8(body, aes);
        return { kind: "dm-text-edit", msgId, ts, enc: true, c };
      } catch {
        /* plain */
      }
    }
    return { kind: "dm-text-edit", msgId, body, ts };
  }

  function withinEditWindow(m: DmMessageRow) {
    const winMs = Math.max(1, messageEditWindowMinutes) * 60_000;
    return Date.now() - m.createdAt <= winMs;
  }

  useEffect(() => {
    if (!selectionMode) return;
    const winMs = Math.max(1, messageEditWindowMinutes) * 60_000;
    const prune = () => {
      setSelectedIds((prev) => {
        const next = new Set<string>();
        for (const id of prev) {
          const m = messages.find((x) => x.id === id);
          if (
            m &&
            m.direction === "out" &&
            !m.deleted &&
            Date.now() - m.createdAt <= winMs
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
  }, [messages, selectionMode, messageEditWindowMinutes]);

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
    if (!peer?.dm.canSendDm) return;
    const eligible = [...selectedIds]
      .map((id) => messages.find((x) => x.id === id))
      .filter((x): x is DmMessageRow => !!x)
      .filter(
        (x) => x.direction === "out" && !x.deleted && withinEditWindow(x)
      );
    if (eligible.length === 0) return;
    if (
      !window.confirm(
        `Удалить ${eligible.length} сообщ. у вас и у собеседника (через сервер)?`
      )
    ) {
      return;
    }
    for (const x of eligible) {
      await deleteOutgoingMessage(x, { skipConfirm: true });
    }
    exitSelection();
  }

  function actionsForMessage(m: DmMessageRow): ChatMessageAction[] {
    const out = m.direction === "out";
    const actions: ChatMessageAction[] = [];
    if (!m.deleted) {
      actions.push({
        key: "reply",
        label: "Ответить",
        onClick: () => setReplyTo(m),
      });
    }
    if (out && !m.deleted && m.kind !== "image" && withinEditWindow(m)) {
      actions.push({
        key: "edit",
        label: "Правка",
        onClick: () => void editOutgoingMessage(m),
      });
    }
    if (out && !m.deleted && withinEditWindow(m)) {
      actions.push({
        key: "del",
        label: "Удалить",
        destructive: true,
        onClick: () => void deleteOutgoingMessage(m),
      });
    }
    if (out && !m.deleted && withinEditWindow(m)) {
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

  function bubblePointerHandlers(m: DmMessageRow) {
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

  async function editOutgoingMessage(m: DmMessageRow) {
    if (m.kind === "image") return;
    if (!peer?.dm.canSendDm) {
      setSendError("Правка недоступна: нет доступа к переписке.");
      return;
    }
    const next = window.prompt("Новый текст", m.body);
    if (next === null) return;
    const body = next.trim();
    if (!body) return;
    const editedAt = Date.now();
    await patchDmMessageLocal(m.id, peerId, { body, editedAt });
    setMessages((prev) =>
      prev.map((x) => (x.id === m.id ? { ...x, body, editedAt } : x))
    );
    try {
      const payload = await buildEditRelayPayload(m.id, body, editedAt);
      await postDmRelay(peerId, payload);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Не удалось синхронизировать правку");
    }
  }

  async function deleteOutgoingMessage(
    m: DmMessageRow,
    opts?: { skipConfirm?: boolean }
  ) {
    if (!peer?.dm.canSendDm) {
      setSendError("Удаление недоступно: нет доступа к переписке.");
      return;
    }
    if (
      !opts?.skipConfirm &&
      !window.confirm("Удалить это сообщение у вас и у собеседника (через сервер)?")
    ) {
      return;
    }
    await patchDmMessageLocal(m.id, peerId, { deleted: true, body: "" });
    setMessages((prev) =>
      prev.map((x) =>
        x.id === m.id ? { ...x, deleted: true, body: "" } : x
      )
    );
    try {
      await postDmRelay(peerId, {
        kind: "dm-delete",
        msgId: m.id,
        ts: Date.now(),
      });
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Не удалось синхронизировать удаление");
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSendError(null);
    const t = text.trim();
    if (!t || !selfId || !peer) return;

    if (peer.dm.blocked || peer.dm.blockedByThem) {
      setSendError("Переписка недоступна.");
      return;
    }

    if (!peer.dm.canSendDm) {
      if (peer.dm.outgoingPending) {
        setSendError("Ожидайте ответа собеседника.");
        return;
      }
      setActionBusy(true);
      const res = await fetch("/api/dm/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toUserId: peerId,
          firstMessagePreview: t,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setActionBusy(false);
      if (!res.ok) {
        setSendError(typeof data.error === "string" ? data.error : "Не удалось отправить запрос");
        return;
      }
      setText("");
      await loadPeer();
      return;
    }

    const id = crypto.randomUUID();
    const reply = replyTo;
    const replyMeta =
      reply && !reply.deleted
        ? { replyToId: reply.id, replySnippet: replySnippetFrom(reply) }
        : undefined;
    const row: DmMessageRow = {
      id,
      peerId,
      direction: "out",
      body: t,
      kind: "text",
      createdAt: Date.now(),
      ...(replyMeta ? replyMeta : {}),
    };
    seenMsgIdsRef.current.add(id);
    await addDmMessage(row);
    setMessages((m) => [...m, row]);
    setText("");
    setReplyTo(null);
    p2pRef.current?.sendText(
      t,
      replyMeta ? { id: replyMeta.replyToId, s: replyMeta.replySnippet } : undefined
    );
    try {
      const payload = await buildRelayPayload(
        "dm-text",
        id,
        t,
        row.createdAt,
        replyMeta
      );
      await postDmRelay(peerId, payload);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Ошибка отправки");
    }
  }

  async function onPickImage(f: File | null) {
    if (!f || !selfId || !peer?.dm.canSendDm) return;
    if (peer.dm.blocked || peer.dm.blockedByThem) return;
    if (!f.type.startsWith("image/")) {
      setSendError("Выберите изображение");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("read"));
      r.readAsDataURL(f);
    });
    if (dataUrl.length > 450_000) {
      setSendError("Файл слишком большой (до ~300 КБ для доставки через сервер).");
      return;
    }
    setSendError(null);
    const id = crypto.randomUUID();
    const reply = replyTo;
    const replyMeta =
      reply && !reply.deleted
        ? { replyToId: reply.id, replySnippet: replySnippetFrom(reply) }
        : undefined;
    const row: DmMessageRow = {
      id,
      peerId,
      direction: "out",
      body: dataUrl,
      kind: "image",
      createdAt: Date.now(),
      ...(replyMeta ? replyMeta : {}),
    };
    seenMsgIdsRef.current.add(id);
    await addDmMessage(row);
    setMessages((m) => [...m, row]);
    setReplyTo(null);
    p2pRef.current?.sendImageDataUrl(
      dataUrl,
      replyMeta ? { id: replyMeta.replyToId, s: replyMeta.replySnippet } : undefined
    );
    try {
      const payload = await buildRelayPayload(
        "dm-image",
        id,
        dataUrl,
        row.createdAt,
        replyMeta
      );
      await postDmRelay(peerId, payload);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Ошибка отправки");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function saveAlias(e: React.FormEvent) {
    e.preventDefault();
    if (!peer) return;
    await upsertContact({
      peerId: peer.id,
      shortCode: peer.shortCode,
      displayName: peer.displayName,
      localAlias: aliasDraft.trim() || null,
      updatedAt: Date.now(),
    });
    setChatPropsOpen(false);
  }

  async function acceptIncoming() {
    if (!peer?.dm.incomingRequestId) return;
    setActionBusy(true);
    const res = await fetch(`/api/dm/requests/${peer.dm.incomingRequestId}/accept`, {
      method: "POST",
      credentials: "include",
    });
    setActionBusy(false);
    if (res.ok && peer) {
      await upsertContact({
        peerId: peer.id,
        shortCode: peer.shortCode,
        displayName: peer.displayName,
        updatedAt: Date.now(),
      });
      notifyInboxAndSidebarRefresh();
      await loadPeer();
    }
  }

  async function declineIncoming() {
    if (!peer?.dm.incomingRequestId) return;
    setActionBusy(true);
    await fetch(`/api/dm/requests/${peer.dm.incomingRequestId}/decline`, {
      method: "POST",
      credentials: "include",
    });
    setActionBusy(false);
    await loadPeer();
  }

  async function blockPeer() {
    if (!peer || !confirm("Заблокировать этого пользователя? Он не сможет писать вам.")) return;
    setActionBusy(true);
    const res = await fetch("/api/users/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ peerId: peer.id }),
      credentials: "include",
    });
    setActionBusy(false);
    if (res.ok) {
      await loadPeer();
      router.refresh();
    }
  }

  async function unblockPeer() {
    if (!peer) return;
    setActionBusy(true);
    await fetch(`/api/users/block?peerId=${encodeURIComponent(peer.id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    setActionBusy(false);
    await loadPeer();
  }

  const title =
    aliasDraft.trim() ||
    peer?.displayName ||
    peer?.shortCode ||
    peerId.slice(0, 8);

  const p2pOk = conn === "connected" && !!peer?.dm.canSendDm;
  const e2eReady =
    !!peer?.publicKeyJwk && typeof peer.publicKeyJwk === "string" && peer.publicKeyJwk.length > 10;

  if (status === "loading" || peerLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-[14px] text-[var(--tg-text-secondary)]">
        Загрузка…
      </div>
    );
  }

  if (!peer) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4">
        <p className="text-[14px] text-[var(--tg-text-secondary)]">Контакт не найден</p>
        <Link href="/add" className="text-[14px] text-[var(--tg-accent)] hover:underline">
          Найти по коду
        </Link>
      </div>
    );
  }

  const inputDisabled =
    actionBusy ||
    peer.dm.blocked ||
    peer.dm.blockedByThem ||
    (!peer.dm.canSendDm && peer.dm.outgoingPending);

  return (
    <div className="chat-panel-shell mx-auto flex min-h-0 w-full max-w-[44rem] flex-1 flex-col overflow-hidden">
      <header className="flex h-[3.25rem] shrink-0 items-center gap-2 border-b border-[var(--tg-border)] bg-[var(--tg-header)] px-2 md:px-4">
        <Link
          href="/chats"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--tg-accent)] md:hidden"
          aria-label="Назад"
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-semibold text-[var(--tg-text)]">{title}</h1>
          <p className="truncate text-[12px] text-[var(--tg-text-secondary)]">
            {p2pOk ? "P2P" : peer.dm.canSendDm ? "через сервер" : "ожидание доступа"}
            {e2eReady ? " · E2E" : ""}
            {peer.shortCode ? ` · ${peer.shortCode}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setChatPropsOpen(true)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[20px] text-[var(--tg-text-secondary)] hover:bg-[var(--tg-hover)]"
          aria-label="Свойства чата"
          title="Свойства чата"
        >
          ⋯
        </button>
      </header>

      <SettingsModalShell
        open={chatPropsOpen}
        title="Чат"
        onClose={() => setChatPropsOpen(false)}
      >
        <form onSubmit={saveAlias} className="space-y-3">
          <label className="block text-[13px] text-[var(--tg-text-secondary)]">
            Как показывать в списках (только у вас)
          </label>
          <div className="flex gap-2">
            <input
              value={aliasDraft}
              onChange={(e) => setAliasDraft(e.target.value)}
              placeholder="Любая подпись"
              className="min-w-0 flex-1 rounded border border-[var(--tg-border)] bg-white px-2 py-2 text-[14px]"
              maxLength={64}
            />
            <button
              type="submit"
              className="shrink-0 rounded-lg bg-[var(--tg-accent)] px-4 py-2 text-[13px] text-white"
            >
              Сохранить
            </button>
          </div>
        </form>
        <div className="mt-6 border-t border-[var(--tg-border)] pt-4">
          <p className="mb-2 text-[13px] text-[var(--tg-text-secondary)]">Блокировка</p>
          {peer.dm.blockedByMe ? (
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => void unblockPeer()}
              className="w-full rounded-xl border border-[var(--tg-border)] px-4 py-3 text-left text-[14px] hover:bg-[var(--tg-hover)] disabled:opacity-50"
            >
              Разблокировать пользователя
            </button>
          ) : (
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => void blockPeer()}
              className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-[14px] font-medium text-red-800 hover:bg-red-100 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
            >
              Заблокировать пользователя
            </button>
          )}
        </div>
      </SettingsModalShell>

      {peer.dm.incomingRequestId && (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900 dark:bg-amber-950/40">
          <p className="text-[13px] text-[var(--tg-text)]">
            <span className="font-medium">{peer.displayName || peer.shortCode}</span> хочет с вами общаться.
            {peer.dm.incomingRequestId && (
              <span className="text-[var(--tg-text-secondary)]"> Примите или отклоните.</span>
            )}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => void acceptIncoming()}
              className="rounded-lg bg-[var(--tg-accent)] px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
            >
              Принять
            </button>
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => void declineIncoming()}
              className="rounded-lg border border-[var(--tg-border)] px-3 py-1.5 text-[13px] disabled:opacity-50"
            >
              Отклонить
            </button>
          </div>
        </div>
      )}

      {!peer.dm.canSendDm && peer.dm.outgoingPending && (
        <div className="shrink-0 border-b border-[var(--tg-border)] bg-[var(--tg-search-bg)] px-3 py-2 text-[13px] text-[var(--tg-text-secondary)]">
          Запрос на переписку отправлен. Ожидайте ответа.
        </div>
      )}

      {!peer.dm.canSendDm && peer.dm.outgoingDeclined && !peer.dm.outgoingPending && (
        <div className="shrink-0 border-b border-[var(--tg-border)] bg-[var(--tg-search-bg)] px-3 py-2 text-[13px] text-[var(--tg-text-secondary)]">
          Запрос отклонён. Вы можете отправить новый запрос сообщением ниже.
        </div>
      )}

      {(peer.dm.blocked || peer.dm.blockedByThem) && (
        <div className="shrink-0 border-b border-[var(--tg-border)] bg-[var(--tg-search-bg)] px-3 py-2 text-[13px] text-[var(--tg-text-secondary)]">
          {peer.dm.blockedByMe
            ? "Вы заблокировали этого пользователя."
            : "Пользователь ограничил переписку с вами."}
        </div>
      )}

      {selectionMode && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--tg-border)] bg-[var(--tg-search-bg)] px-3 py-2">
          <span className="text-[13px] text-[var(--tg-text)]">
            Выбрано: {selectedIds.size}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exitSelection}
              className="rounded-lg px-3 py-1.5 text-[13px] text-[var(--tg-text-secondary)] hover:bg-[var(--tg-hover)]"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={() => void deleteSelectedMessages()}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-40"
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
        <div className="mt-auto flex flex-col gap-2 px-2 py-3 sm:px-3">
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
                {block.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex w-full min-w-0 ${m.direction === "out" ? "justify-end" : "justify-start"}`}
                  >
                    <SwipeReplyRow
                      enabled={
                        !selectionMode &&
                        !m.deleted &&
                        !!peer?.dm.canSendDm
                      }
                      onReply={() => setReplyTo(m)}
                    >
                      <div
                        className={`flex w-fit max-w-full min-w-0 flex-col gap-2 rounded-sm border p-3 text-left text-[14px] leading-snug select-none overflow-hidden ${
                          m.direction === "out"
                            ? "border-[var(--tg-accent)] bg-[var(--tg-accent)] text-white"
                            : "border-[var(--tg-border)] bg-[var(--tg-search-bg)] text-[var(--tg-text)]"
                        } ${
                          selectionMode &&
                          selectedIds.has(m.id) &&
                          m.direction === "out" &&
                          withinEditWindow(m)
                            ? "ring-2 ring-[var(--tg-accent)] ring-offset-2 ring-offset-[var(--tg-main)]"
                            : ""
                        } ${
                          selectionMode && m.direction === "out" && withinEditWindow(m)
                            ? "cursor-pointer"
                            : ""
                        }`}
                        {...bubblePointerHandlers(m)}
                        onDoubleClick={(e) => {
                          e.preventDefault();
                          if (selectionMode) return;
                          if (suppressBubbleClickRef.current) return;
                          if (!peer?.dm.canSendDm || m.deleted) return;
                          setReplyTo(m);
                        }}
                        onClick={() => {
                          if (!selectionMode) return;
                          if (suppressBubbleClickRef.current) return;
                          if (m.direction !== "out" || !withinEditWindow(m)) return;
                          toggleSelect(m.id);
                        }}
                      >
                        {m.replySnippet && !m.deleted ? (
                          <div
                            className={`border-l-2 pl-2 text-[11px] leading-tight ${
                              m.direction === "out"
                                ? "border-white/50 opacity-95"
                                : "border-[var(--tg-text-secondary)] opacity-90"
                            }`}
                          >
                            ↩ {m.replySnippet}
                          </div>
                        ) : null}
                        {m.deleted ? (
                          <span className="italic opacity-80">Сообщение удалено</span>
                        ) : m.kind === "image" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.body}
                            alt=""
                            className={`max-h-64 max-w-full rounded-sm object-contain ${obfuscateEnabled ? "blur-xl" : ""}`}
                          />
                        ) : (
                          <span className="break-words">{maskText(m.body)}</span>
                        )}
                        {m.editedAt && !m.deleted && m.kind !== "image" ? (
                          <span
                            className={`text-[10px] ${
                              m.direction === "out" ? "text-white/70" : "opacity-70"
                            }`}
                          >
                            изм.
                          </span>
                        ) : null}
                      </div>
                    </SwipeReplyRow>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <form
        onSubmit={send}
        className="flex shrink-0 flex-col gap-1 border-t border-[var(--tg-border)] bg-[var(--tg-header)] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] md:pb-2"
      >
        {replyTo && peer.dm.canSendDm && (
          <div className="flex items-center gap-2 rounded-lg border border-[var(--tg-border)] bg-[var(--tg-search-bg)] px-2 py-1.5">
            <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--tg-text-secondary)]">
              ↩ {replySnippetFrom(replyTo)}
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
        {sendError && (
          <p className="text-[12px] text-red-600" role="alert">
            {sendError}
          </p>
        )}
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onPickImage(e.target.files?.[0] ?? null)}
          />
          {peer.dm.canSendDm && (
            <button
              type="button"
              disabled={inputDisabled}
              onClick={() => fileRef.current?.click()}
              className="shrink-0 rounded-lg border border-[var(--tg-border)] px-3 py-2 text-[13px] text-[var(--tg-text)] hover:bg-[var(--tg-hover)] disabled:opacity-40"
              title="Фото"
            >
              📷
            </button>
          )}
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              peer.dm.canSendDm
                ? "Сообщение…"
                : peer.dm.outgoingPending
                  ? "Ожидание ответа…"
                  : "Текст запроса…"
            }
            disabled={inputDisabled}
            className="min-w-0 flex-1 rounded-lg border border-[var(--tg-border)] bg-white px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-[var(--tg-accent)] disabled:opacity-50"
            maxLength={4000}
          />
          <button
            type="submit"
            disabled={!text.trim() || inputDisabled}
            className="shrink-0 rounded-lg bg-[var(--tg-accent)] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-40"
          >
            {peer.dm.canSendDm ? "Отпр." : "Запрос"}
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
