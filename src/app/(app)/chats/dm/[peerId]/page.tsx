import { notFound } from "next/navigation";
import { DmChatView } from "@/components/chat/DmChatView";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Props = { params: Promise<{ peerId: string }> };

export default async function DmChatPage({ params }: Props) {
  const { peerId } = await params;
  if (!UUID_RE.test(peerId)) {
    notFound();
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DmChatView peerId={peerId} />
    </div>
  );
}
