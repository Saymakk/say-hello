import { auth } from "@/auth";
import { NextResponse } from "next/server";

/**
 * Защищает личный кабинет, группы и страницу «добавить по коду».
 * Не залогиненных с /add уводим на логин с return URL (удобно после скана QR).
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthed = !!req.auth;

  if (
    !isAuthed &&
    (pathname.startsWith("/dashboard") ||
      pathname.startsWith("/groups") ||
      pathname.startsWith("/add"))
  ) {
    const login = new URL("/login", req.url);
    login.searchParams.set(
      "callbackUrl",
      `${pathname}${req.nextUrl.search}`
    );
    return NextResponse.redirect(login);
  }

  if (isAuthed && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/groups",
    "/groups/:path*",
    "/add",
    "/login",
    "/register",
  ],
};
