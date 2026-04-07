import { NextResponse } from "next/server";
import { auth } from "@/auth";

type Ctx = { params: Promise<{ id: string; messageId: string }> };

/** Редактирование/удаление групповых сообщений только на клиенте (сигналы). */
export async function PATCH(_request: Request, _context: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  return NextResponse.json(
    { error: "Используйте локальное действие в приложении." },
    { status: 410 }
  );
}

export async function DELETE(_request: Request, _context: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  return NextResponse.json(
    { error: "Используйте локальное действие в приложении." },
    { status: 410 }
  );
}
