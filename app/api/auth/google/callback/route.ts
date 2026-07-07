import { NextRequest, NextResponse } from "next/server";
import { findOrCreateGoogleUser } from "@/lib/auth/store";
import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth/session";

const GOOGLE_STATE_COOKIE = "djv_google_state";

type GoogleTokenResponse = {
  access_token?: string;
};

type GoogleProfile = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

function getBaseUrl(request: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
}

function redirectToLogin(request: NextRequest, error = "google_failed") {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", error);

  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get(GOOGLE_STATE_COOKIE)?.value;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!code || !state || !storedState || state !== storedState) {
    return redirectToLogin(request);
  }

  if (!clientId || !clientSecret) {
    return redirectToLogin(request, "google_not_configured");
  }

  const callbackUrl = new URL("/api/auth/google/callback", getBaseUrl(request));
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: callbackUrl.toString(),
    }),
  });

  if (!tokenResponse.ok) {
    return redirectToLogin(request);
  }

  const token = (await tokenResponse.json()) as GoogleTokenResponse;

  if (!token.access_token) {
    return redirectToLogin(request);
  }

  const profileResponse = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
      },
    },
  );

  if (!profileResponse.ok) {
    return redirectToLogin(request);
  }

  const profile = (await profileResponse.json()) as GoogleProfile;

  if (!profile.sub || !profile.email || profile.email_verified === false) {
    return redirectToLogin(request);
  }

  const user = await findOrCreateGoogleUser({
    googleId: profile.sub,
    email: profile.email,
    name: profile.name,
    avatarUrl: profile.picture,
  });

  const response = NextResponse.redirect(
    new URL(user.plan !== "free" ? "/collections" : "/account", request.url),
  );

  response.cookies.set(
    SESSION_COOKIE,
    createSessionToken(user.id),
    sessionCookieOptions,
  );
  response.cookies.set(GOOGLE_STATE_COOKIE, "", {
    maxAge: 0,
    path: "/",
  });

  return response;
}
