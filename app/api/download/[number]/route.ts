import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { registerDownloadAttempt } from "@/lib/downloads/store";
import {
  DEMO_COLLECTION_NUMBER,
  findCollectionByNumber,
} from "@/lib/content/collections";
import { createSignedDownloadUrl, getS3ObjectMetadata } from "@/lib/storage/s3";

type RouteContext = {
  params: Promise<{
    number: string;
  }>;
};

function redirectTo(path: string, request: NextRequest) {
  return NextResponse.redirect(new URL(path, request.url));
}

function redirectToCollections(
  request: NextRequest,
  download: string,
  collectionNumber: string,
) {
  const url = new URL("/collections", request.url);

  url.searchParams.set("download", download);
  url.searchParams.set("collection", collectionNumber);
  url.hash =
    collectionNumber === DEMO_COLLECTION_NUMBER
      ? "demo-download"
      : `collection-${collectionNumber}`;

  return NextResponse.redirect(url);
}

function getClientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { number } = await context.params;
  const collection = await findCollectionByNumber(number);

  if (!collection || !collection.isActive) {
    return redirectTo("/collections", request);
  }

  const user = await getCurrentUser();

  if (!user) {
    return redirectTo("/login", request);
  }

  if (collection.number !== DEMO_COLLECTION_NUMBER) {
    if (user.plan === "free") {
      return redirectTo("/pricing", request);
    }
  }

  if (!collection.s3Key) {
    return redirectToCollections(request, "not_configured", collection.number);
  }

  let signedUrl: string;

  try {
    const metadata = await getS3ObjectMetadata(collection.s3Key);

    if (!metadata) {
      return redirectToCollections(request, "storage", collection.number);
    }

    signedUrl = createSignedDownloadUrl(collection.s3Key);
  } catch {
    return redirectToCollections(request, "storage", collection.number);
  }

  const download = await registerDownloadAttempt({
    archiveId: collection.number,
    ipAddress: getClientIp(request),
    limit: collection.downloadLimit,
    userAgent: request.headers.get("user-agent") ?? "unknown",
    userId: user.id,
  });

  if (!download.allowed) {
    return redirectToCollections(request, "limit", collection.number);
  }

  return NextResponse.redirect(signedUrl);
}
