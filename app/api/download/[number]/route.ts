import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  DEMO_COLLECTION_NUMBER,
  findCollectionByNumber,
} from "@/lib/content/collections";

type RouteContext = {
  params: Promise<{
    number: string;
  }>;
};

function redirectTo(path: string, request: NextRequest) {
  return NextResponse.redirect(new URL(path, request.url));
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { number } = await context.params;
  const collection = await findCollectionByNumber(number);

  if (!collection) {
    return redirectTo("/collections", request);
  }

  if (collection.number !== DEMO_COLLECTION_NUMBER) {
    const user = await getCurrentUser();

    if (!user) {
      return redirectTo("/login", request);
    }

    if (user.plan === "free") {
      return redirectTo("/pricing", request);
    }
  }

  if (!collection.downloadUrl) {
    const url = new URL("/collections", request.url);
    url.searchParams.set("download", "not_configured");
    url.searchParams.set("collection", collection.number);
    url.hash =
      collection.number === DEMO_COLLECTION_NUMBER
        ? "demo-download"
        : `collection-${collection.number}`;

    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(collection.downloadUrl);
}
