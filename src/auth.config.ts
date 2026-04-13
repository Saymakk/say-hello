import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

/**
 * Конфиг без Node-only зависимостей на верхнем уровне — чтобы middleware (Edge) собирался.
 * Авторизация по паролю делегирована в динамический импорт.
 */
export default {
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        phone: { label: "Phone", type: "text" },
        password: { label: "Password", type: "password" },
        passkeyCode: { label: "Passkey code", type: "text" },
      },
      authorize: async (credentials) => {
        const { authorizeCredentials } = await import(
          "@/lib/auth/authorize-credentials"
        );
        return authorizeCredentials(credentials);
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
