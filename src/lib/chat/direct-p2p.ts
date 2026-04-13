import { registerSignalHandler, unregisterSignalHandler } from "./signal-hub";

type SignalPayload =
  | { kind: "offer"; sdp: RTCSessionDescriptionInit }
  | { kind: "answer"; sdp: RTCSessionDescriptionInit }
  | { kind: "ice"; candidate: RTCIceCandidateInit };

export type DmReplyWire = { id: string; s: string };

export type DmWirePayload =
  | { v: 1; i: string; t: "text"; b: string; r?: DmReplyWire }
  | { v: 1; i: string; t: "img"; b: string; r?: DmReplyWire };

export type DmIncomingPayload = DmWirePayload | { legacyText: string };

async function postSignal(toUserId: string, payload: SignalPayload) {
  await fetch("/api/signals", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      toUserId,
      payload: JSON.stringify(payload),
    }),
  });
}

export class DirectP2P {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private active = false;

  constructor(
    private selfId: string,
    private peerId: string,
    private onPayload: (p: DmIncomingPayload) => void,
    private onConnection: (state: string) => void
  ) {}

  async start() {
    if (this.active) return;
    this.active = true;
    registerSignalHandler(this.peerId, (p) => {
      void this.handleSignal(p);
    });

    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    this.pc.onicecandidate = (ev) => {
      if (ev.candidate && this.pc) {
        void postSignal(this.peerId, {
          kind: "ice",
          candidate: ev.candidate.toJSON(),
        });
      }
    };

    this.pc.onconnectionstatechange = () => {
      const s = this.pc?.connectionState ?? "closed";
      this.onConnection(s);
    };

    const initiator = this.selfId < this.peerId;

    if (initiator) {
      const dc = this.pc.createDataChannel("chat", { ordered: true });
      this.setupDc(dc);
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      if (this.pc.localDescription) {
        await postSignal(this.peerId, {
          kind: "offer",
          sdp: {
            type: this.pc.localDescription.type,
            sdp: this.pc.localDescription.sdp ?? "",
          },
        });
      }
    } else {
      this.pc.ondatachannel = (ev) => {
        this.setupDc(ev.channel);
      };
    }
  }

  private setupDc(dc: RTCDataChannel) {
    this.dc = dc;
    dc.onopen = () => this.onConnection("connected");
    dc.onclose = () => this.onConnection("disconnected");
    dc.onmessage = (ev) => {
      const raw = String(ev.data);
      try {
        const j = JSON.parse(raw) as unknown;
        if (
          typeof j === "object" &&
          j !== null &&
          (j as { v?: number }).v === 1 &&
          (j as { t?: string }).t === "text" &&
          typeof (j as { b?: string }).b === "string"
        ) {
          const jo = j as { i?: string; b: string; r?: { id?: string; s?: string } };
          if (typeof jo.i !== "string") return;
          const r =
            jo.r &&
            typeof jo.r.id === "string" &&
            typeof jo.r.s === "string"
              ? { id: jo.r.id, s: jo.r.s }
              : undefined;
          this.onPayload(
            r
              ? { v: 1, i: jo.i, t: "text", b: jo.b, r }
              : { v: 1, i: jo.i, t: "text", b: jo.b }
          );
          return;
        }
        if (
          typeof j === "object" &&
          j !== null &&
          (j as { v?: number }).v === 1 &&
          (j as { t?: string }).t === "img" &&
          typeof (j as { b?: string }).b === "string"
        ) {
          const jo = j as { i?: string; b: string; r?: { id?: string; s?: string } };
          if (typeof jo.i !== "string") return;
          const r =
            jo.r &&
            typeof jo.r.id === "string" &&
            typeof jo.r.s === "string"
              ? { id: jo.r.id, s: jo.r.s }
              : undefined;
          this.onPayload(
            r
              ? { v: 1, i: jo.i, t: "img", b: jo.b, r }
              : { v: 1, i: jo.i, t: "img", b: jo.b }
          );
          return;
        }
      } catch {
        /* legacy plain text */
      }
      this.onPayload({ legacyText: raw });
    };
  }

  private async handleSignal(raw: string) {
    if (!this.pc) return;
    let data: SignalPayload;
    try {
      data = JSON.parse(raw) as SignalPayload;
    } catch {
      return;
    }
    if (
      data.kind !== "offer" &&
      data.kind !== "answer" &&
      data.kind !== "ice"
    ) {
      return;
    }
    try {
      if (data.kind === "offer") {
        await this.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        if (this.pc.localDescription) {
          await postSignal(this.peerId, {
            kind: "answer",
            sdp: {
              type: this.pc.localDescription.type,
              sdp: this.pc.localDescription.sdp ?? "",
            },
          });
        }
      } else if (data.kind === "answer") {
        await this.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      } else if (data.kind === "ice" && data.candidate) {
        await this.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    } catch {
      /* sdp race */
    }
  }

  sendText(msgId: string, text: string, reply?: DmReplyWire) {
    if (this.dc?.readyState === "open") {
      const o: Record<string, unknown> = { v: 1, i: msgId, t: "text", b: text };
      if (reply) o.r = { id: reply.id, s: reply.s };
      this.dc.send(JSON.stringify(o));
    }
  }

  sendImageDataUrl(msgId: string, dataUrl: string, reply?: DmReplyWire) {
    if (this.dc?.readyState === "open") {
      const o: Record<string, unknown> = { v: 1, i: msgId, t: "img", b: dataUrl };
      if (reply) o.r = { id: reply.id, s: reply.s };
      this.dc.send(JSON.stringify(o));
    }
  }

  getDataChannelState() {
    return this.dc?.readyState ?? "closed";
  }

  stop() {
    unregisterSignalHandler(this.peerId);
    try {
      this.dc?.close();
    } catch {
      /* */
    }
    try {
      this.pc?.close();
    } catch {
      /* */
    }
    this.dc = null;
    this.pc = null;
    this.active = false;
  }
}
