import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import type { AuthProvider, TariffPlan } from "@/lib/auth/store";
import { findOrCreateGoogleUser } from "@/lib/auth/store";

if (!process.env.AUTH_GOOGLE_ID && process.env.GOOGLE_CLIENT_ID) {
  process.env.AUTH_GOOGLE_ID = process.env.GOOGLE_CLIENT_ID;
}

if (!process.env.AUTH_GOOGLE_SECRET && process.env.GOOGLE_CLIENT_SECRET) {
  process.env.AUTH_GOOGLE_SECRET = process.env.GOOGLE_CLIENT_SECRET;
}

type GoogleOAuthProfile = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

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

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Google({
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") {
        return true;
      }

      const googleProfile = profile as GoogleOAuthProfile | undefined;

      return Boolean(
        googleProfile?.sub &&
          googleProfile.email &&
          googleProfile.email_verified !== false,
      );
    },
    async jwt({ token, account, profile }) {
      if (account?.provider === "google") {
        const googleProfile = profile as GoogleOAuthProfile | undefined;

        if (googleProfile?.sub && googleProfile.email) {
          const user = await findOrCreateGoogleUser({
            googleId: googleProfile.sub,
            email: googleProfile.email,
            name: googleProfile.name,
            avatarUrl: googleProfile.picture,
          });

          token.userId = user.id;
          token.plan = user.plan;
          token.planExpiresAt = user.planExpiresAt;
          token.providers = user.providers;
          token.avatarUrl = user.avatarUrl;
          token.createdAt = user.createdAt;
        }
      }

      return token;
    },
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
