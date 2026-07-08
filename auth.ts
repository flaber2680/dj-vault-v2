import NextAuth, { type DefaultSession } from "next-auth";
import type { AuthProvider, TariffPlan } from "@/lib/auth/store";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      plan?: TariffPlan;
      planExpiresAt?: string;
      providers?: AuthProvider[];
      avatarUrl?: string;
      createdAt?: string;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
    plan?: TariffPlan;
    planExpiresAt?: string;
    providers?: AuthProvider[];
    avatarUrl?: string;
    createdAt?: string;
  }
}

export const { handlers, auth, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        if (token.userId) {
          session.user.id = token.userId;
        }

        if (token.plan) {
          session.user.plan = token.plan;
        }

        session.user.planExpiresAt = token.planExpiresAt;
        session.user.providers = token.providers;
        session.user.avatarUrl = token.avatarUrl;
        session.user.createdAt = token.createdAt;
      }

      return session;
    },
  },
});
