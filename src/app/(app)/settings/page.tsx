import { eq } from "drizzle-orm";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { EmergencyLocalData } from "@/components/EmergencyLocalData";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { MessagePrivacySettings } from "@/components/MessagePrivacySettings";
import { MessageStorageInfo } from "@/components/MessageStorageInfo";
import { PasskeySettings } from "@/components/PasskeySettings";
import { PasswordChangeForm } from "@/components/PasswordChangeForm";
import { PwaInstallHint } from "@/components/PwaInstallHint";
import { ProfileNickForm } from "@/components/ProfileNickForm";
import { SettingsIntro } from "@/components/SettingsIntro";
import { ShareIdentity } from "@/components/ShareIdentity";
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
      shortCode: users.shortCode,
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
  const addUrl = `${base}/add?c=${encodeURIComponent(row.shortCode)}`;

  return (
    <>
      <MainHeader titleKey="settings.title" subtitleKey="settings.subtitle" />
      <div className="tg-scroll flex-1 overflow-y-auto px-4 py-6 md:px-3 md:py-4">
        <SettingsIntro />
        <PwaInstallHint />
        <div className="mb-1">
          <Link
            href="/settings/guide"
            className="inline-flex rounded-lg border border-[var(--tg-border)] bg-[var(--tg-sidebar)] px-3 py-2 text-[13px] font-medium text-[var(--tg-accent)] hover:bg-[var(--tg-hover)]"
          >
            Гайд по возможностям приложения
          </Link>
        </div>
        <div className="rounded-xl border border-[var(--tg-border)] bg-[var(--tg-sidebar)] p-6 md:p-4">
          <ShareIdentity shortCode={row.shortCode} addUrl={addUrl} />
        </div>
        <LanguageSwitcher />
        <ProfileNickForm initialDisplayName={row.displayName} />
        <MessagePrivacySettings initialWindowMinutes={row.messageEditWindowMinutes} />
        <PasswordChangeForm />
        <PasskeySettings initialPasskeyCount={passkeys.length} />
        <EmergencyLocalData />
        <MessageStorageInfo />
      </div>
    </>
  );
}
