import { notFound } from "next/navigation";
import { DmChatView } from "@/components/chat/DmChatView";
import { isValidPhone, normalizePhone } from "@/lib/phone";

type Props = { params: Promise<{ peerId: string }> };

export default async function DmChatPage({ params }: Props) {
  const { peerId: rawPeerId } = await params;
  const peerId = normalizePhone(rawPeerId);
  if (!isValidPhone(peerId)) {
    notFound();
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DmChatView peerId={peerId} />
    </div>
  );
}
