import { registerSignalHandler, unregisterSignalHandler } from "./signal-hub";

type SignalPayload =
  | { kind: "offer"; sdp: RTCSessionDescriptionInit }
  | { kind: "answer"; sdp: RTCSessionDescriptionInit }
  | { kind: "ice"; candidate: RTCIceCandidateInit };

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
    private onText: (text: string) => void,
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
      try {
        const j = JSON.parse(String(ev.data)) as { text?: string };
        if (typeof j.text === "string") this.onText(j.text);
      } catch {
        this.onText(String(ev.data));
      }
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

  send(text: string) {
    if (this.dc?.readyState === "open") {
      this.dc.send(JSON.stringify({ text, ts: Date.now() }));
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
