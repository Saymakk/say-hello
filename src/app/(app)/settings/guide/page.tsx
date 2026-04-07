import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { GuideContent } from "@/components/settings/GuideContent";
import { MainHeader } from "@/components/telegram/MainHeader";

export default async function SettingsGuidePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <>
      <MainHeader titleKey="guide.title" subtitleKey="guide.subtitle" />
      <div className="tg-scroll flex-1 overflow-y-auto px-4 py-6 md:px-3 md:py-4">
        <div className="mx-auto max-w-xl space-y-5 text-[14px] leading-relaxed text-[var(--tg-text)] md:space-y-4">
          <p>
            <Link href="/settings" className="text-[var(--tg-accent)] hover:underline">
              ← Настройки
            </Link>
          </p>
          <GuideContent />
        </div>
      </div>
    </>
  );
}
