import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthed = !!req.auth;

  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return NextResponse.redirect(new URL("/settings", req.url));
  }

  if (
    !isAuthed &&
    (pathname.startsWith("/chats") ||
      pathname.startsWith("/settings") ||
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
    return NextResponse.redirect(new URL("/chats", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/chats/:path*",
    "/settings/:path*",
    "/groups/:path*",
    "/add/:path*",
    "/dashboard/:path*",
    "/login",
    "/register",
  ],
};
