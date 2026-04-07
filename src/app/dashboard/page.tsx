import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ShareIdentity } from "@/components/ShareIdentity";
import { NavBar } from "@/components/NavBar";
import { ProfileNickForm } from "@/components/ProfileNickForm";
import { db } from "@/db";
import { users } from "@/db/schema";

export default async function DashboardPage() {
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
      <NavBar />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          Ваш профиль
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Поделитесь кодом или QR — так вас смогут найти в приложении.
        </p>
        <div className="mt-8 rounded-2xl bg-[var(--card)] p-8 shadow-sm ring-1 ring-[var(--ring)]">
          <ShareIdentity shortCode={row.shortCode} addUrl={addUrl} />
        </div>
        <ProfileNickForm initialDisplayName={row.displayName} />
      </main>
    </>
  );
}
