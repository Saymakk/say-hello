import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ShareIdentity } from "@/components/ShareIdentity";
import { ProfileNickForm } from "@/components/ProfileNickForm";
import { MainHeader } from "@/components/telegram/MainHeader";
import { db } from "@/db";
import { users } from "@/db/schema";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const [row] = await db
    .select({
      shortCode: users.shortCode,
      displayName: users.displayName,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!row) {
    redirect("/login");
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? `${proto}://${host}`;
  const addUrl = `${base}/add?c=${encodeURIComponent(row.shortCode)}`;

  return (
    <>
      <MainHeader title="Настройки" subtitle="Профиль и код для связи" />
      <div className="tg-scroll flex-1 overflow-y-auto px-4 py-6">
        <p className="mb-4 text-[14px] text-[var(--tg-text-secondary)]">
          Поделитесь кодом или QR — так вас смогут найти в приложении.
        </p>
        <div className="rounded-xl border border-[var(--tg-border)] bg-[var(--tg-sidebar)] p-6">
          <ShareIdentity shortCode={row.shortCode} addUrl={addUrl} />
        </div>
        <ProfileNickForm initialDisplayName={row.displayName} />
      </div>
    </>
  );
}
