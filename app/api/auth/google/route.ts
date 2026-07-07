import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const GOOGLE_STATE_COOKIE = "djv_google_state";

function getBaseUrl(request: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
}

function redirectWithError(request: NextRequest) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", "google_not_configured");

  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return redirectWithError(request);
  }

  const state = randomBytes(24).toString("hex");
  const callbackUrl = new URL("/api/auth/google/callback", getBaseUrl(request));
  const googleUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");

  googleUrl.searchParams.set("client_id", clientId);
  googleUrl.searchParams.set("redirect_uri", callbackUrl.toString());
  googleUrl.searchParams.set("response_type", "code");
  googleUrl.searchParams.set("scope", "openid email profile");
  googleUrl.searchParams.set("state", state);
  googleUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(googleUrl);
  response.cookies.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: 60 * 10,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
