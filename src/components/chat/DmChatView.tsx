"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  decryptUtf8,
  deriveSharedAesKey,
  encryptUtf8,
} from "@/lib/crypto/dm-e2e";
import { useChatObfuscation } from "@/components/ChatObfuscationProvider";
import { DirectP2P } from "@/lib/chat/direct-p2p";
import { postDmRelay, type DmRelayPayload } from "@/lib/chat/dm-relay";
import { setDmLastReadMs } from "@/lib/chat/read-state";
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
  const [aliasOpen, setAliasOpen] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const p2pRef = useRef<DirectP2P | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const relaySinceRef = useRef<Date>(new Date(Date.now() - 120_000));
  const seenMsgIdsRef = useRef<Set<string>>(new Set());
  const [messageEditWindowMinutes, setMessageEditWindowMinutes] = useState(30);

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
          const row: DmMessageRow = {
            id,
            peerId,
            direction: "in",
            body: incoming.b,
            kind: "text",
            createdAt: Date.now(),
          };
          await addDmMessage(row);
          setMessages((m) => [...m, row]);
          return;
        }
        if (incoming.t === "img") {
          const id = crypto.randomUUID();
          const row: DmMessageRow = {
            id,
            peerId,
            direction: "in",
            body: incoming.b,
            kind: "image",
            createdAt: Date.now(),
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
          const dm: DmMessageRow = {
            id: mid,
            peerId,
            direction: "in",
            body,
            kind,
            createdAt: typeof p.ts === "number" ? p.ts : t.getTime(),
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
    ts: number
  ): Promise<DmRelayPayload> {
    const p = peerRef.current;
    if (p?.publicKeyJwk) {
      try {
        const ident = await ensureE2eIdentity();
        const peerPub = JSON.parse(p.publicKeyJwk) as JsonWebKey;
        const aes = await deriveSharedAesKey(ident.privateJwk, peerPub);
        const c = await encryptUtf8(body, aes);
        return kind === "dm-text"
          ? { kind: "dm-text", msgId, ts, enc: true, c }
          : { kind: "dm-image", msgId, ts, enc: true, c };
      } catch {
        /* fallback plain */
      }
    }
    return kind === "dm-text"
      ? { kind: "dm-text", msgId, body, ts }
      : { kind: "dm-image", msgId, body, ts };
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

  async function editOutgoingMessage(m: DmMessageRow) {
    if (!peer?.dm.canSendDm || m.kind === "image") return;
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

  async function deleteOutgoingMessage(m: DmMessageRow) {
    if (!peer?.dm.canSendDm) return;
    if (!window.confirm("Удалить это сообщение у вас и у собеседника (через сервер)?")) return;
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
    const row: DmMessageRow = {
      id,
      peerId,
      direction: "out",
      body: t,
      kind: "text",
      createdAt: Date.now(),
    };
    seenMsgIdsRef.current.add(id);
    await addDmMessage(row);
    setMessages((m) => [...m, row]);
    setText("");
    p2pRef.current?.sendText(t);
    try {
      const payload = await buildRelayPayload("dm-text", id, t, row.createdAt);
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
    const row: DmMessageRow = {
      id,
      peerId,
      direction: "out",
      body: dataUrl,
      kind: "image",
      createdAt: Date.now(),
    };
    seenMsgIdsRef.current.add(id);
    await addDmMessage(row);
    setMessages((m) => [...m, row]);
    p2pRef.current?.sendImageDataUrl(dataUrl);
    try {
      const payload = await buildRelayPayload("dm-image", id, dataUrl, row.createdAt);
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
    setAliasOpen(false);
  }

  async function acceptIncoming() {
    if (!peer?.dm.incomingRequestId) return;
    setActionBusy(true);
    const res = await fetch(`/api/dm/requests/${peer.dm.incomingRequestId}/accept`, {
      method: "POST",
      credentials: "include",
    });
    setActionBusy(false);
    if (res.ok) await loadPeer();
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
          <div className="flex items-center gap-1">
            <h1 className="truncate text-[15px] font-semibold text-[var(--tg-text)]">{title}</h1>
            <button
              type="button"
              onClick={() => setAliasOpen((v) => !v)}
              className="shrink-0 rounded p-1 text-[11px] text-[var(--tg-accent)] hover:underline"
              title="Подпись для себя"
            >
              ✎
            </button>
          </div>
          <p className="truncate text-[12px] text-[var(--tg-text-secondary)]">
            {p2pOk ? "P2P" : peer.dm.canSendDm ? "через сервер" : "ожидание доступа"}
            {e2eReady ? " · E2E" : ""}
            {peer.shortCode ? ` · ${peer.shortCode}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {peer.dm.blockedByMe ? (
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => void unblockPeer()}
              className="rounded-lg px-2 py-1 text-[12px] text-[var(--tg-text-secondary)] hover:bg-[var(--tg-hover)]"
            >
              Разблок.
            </button>
          ) : (
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => void blockPeer()}
              className="rounded-lg px-2 py-1 text-[12px] text-red-600 hover:bg-[var(--tg-hover)]"
            >
              Блок
            </button>
          )}
        </div>
      </header>

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

      {aliasOpen && (
        <form
          onSubmit={saveAlias}
          className="shrink-0 border-b border-[var(--tg-border)] bg-[var(--tg-search-bg)] px-3 py-2"
        >
          <label className="block text-[11px] text-[var(--tg-text-secondary)]">
            Как показывать в списках (только у вас)
          </label>
          <div className="mt-1 flex gap-2">
            <input
              value={aliasDraft}
              onChange={(e) => setAliasDraft(e.target.value)}
              placeholder="Любая подпись"
              className="min-w-0 flex-1 rounded border border-[var(--tg-border)] bg-white px-2 py-1 text-[13px]"
              maxLength={64}
            />
            <button
              type="submit"
              className="rounded bg-[var(--tg-accent)] px-3 py-1 text-[12px] text-white"
            >
              OK
            </button>
          </div>
        </form>
      )}

      <div
        ref={scrollRef}
        className="tg-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden"
      >
        <div className="mt-auto flex flex-col gap-2 px-3 py-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col gap-1 ${m.direction === "out" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[min(85%,24rem)] overflow-hidden rounded-2xl px-3 py-2 text-[14px] leading-snug ${
                  m.direction === "out"
                    ? "rounded-br-sm bg-[var(--tg-accent)] text-white"
                    : "rounded-bl-sm bg-[var(--tg-search-bg)] text-[var(--tg-text)]"
                }`}
              >
                {m.deleted ? (
                  <span className="italic opacity-80">Сообщение удалено</span>
                ) : m.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.body}
                    alt=""
                    className={`max-h-64 max-w-full rounded-lg object-contain ${obfuscateEnabled ? "blur-xl" : ""}`}
                  />
                ) : (
                  maskText(m.body)
                )}
                {m.editedAt && !m.deleted && m.kind !== "image" ? (
                  <span
                    className={`mt-1 block text-[10px] ${
                      m.direction === "out" ? "text-white/70" : "opacity-70"
                    }`}
                  >
                    изм.
                  </span>
                ) : null}
              </div>
              {m.direction === "out" &&
                peer?.dm.canSendDm &&
                !m.deleted &&
                withinEditWindow(m) && (
                  <div className="flex gap-2 px-1">
                    {m.kind !== "image" && (
                      <button
                        type="button"
                        onClick={() => void editOutgoingMessage(m)}
                        className="text-[11px] text-[var(--tg-accent)] hover:underline"
                      >
                        Правка
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void deleteOutgoingMessage(m)}
                      className="text-[11px] text-red-600 hover:underline"
                    >
                      Удалить
                    </button>
                  </div>
                )}
            </div>
          ))}
        </div>
      </div>

      <form
        onSubmit={send}
        className="flex shrink-0 flex-col gap-1 border-t border-[var(--tg-border)] bg-[var(--tg-header)] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] md:pb-2"
      >
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
    </div>
  );
}
