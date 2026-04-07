import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AddContactsView } from "@/components/AddContactsView";

type Props = { searchParams: Promise<{ c?: string }> };

export default async function AddPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const { c } = await searchParams;
  const preset = c?.trim().toUpperCase() ?? "";

  return <AddContactsView initialCode={preset} />;
}
