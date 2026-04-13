import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SettingsMenuClient } from "@/components/settings/SettingsMenuClient";
import { MainHeader } from "@/components/telegram/MainHeader";
import { db } from "@/db";
import { users, webauthnCredentials } from "@/db/schema";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const [row] = await db
    .select({
      phone: users.phone,
      displayName: users.displayName,
      messageEditWindowMinutes: users.messageEditWindowMinutes,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!row) {
    redirect("/login");
  }
  const passkeys = await db
    .select({ id: webauthnCredentials.id })
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.userId, session.user.id));
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? `${proto}://${host}`;
  const addUrl = `${base}/add?p=${encodeURIComponent(row.phone)}`;

  return (
    <>
      <MainHeader titleKey="settings.title" subtitleKey="settings.subtitle" />
      <div className="tg-scroll flex-1 overflow-y-auto px-3 py-3 md:px-3 md:py-3">
        <SettingsMenuClient
          phone={row.phone}
          addUrl={addUrl}
          displayName={row.displayName}
          messageEditWindowMinutes={row.messageEditWindowMinutes}
          passkeyCount={passkeys.length}
        />
      </div>
    </>
  );
}
