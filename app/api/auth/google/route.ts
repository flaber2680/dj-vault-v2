import { NextRequest, NextResponse } from "next/server";

export function GET(request: NextRequest) {
  const signInUrl = new URL("/api/auth/signin/google", request.url);
  signInUrl.searchParams.set("callbackUrl", "/account");

  return NextResponse.redirect(signInUrl);
}
