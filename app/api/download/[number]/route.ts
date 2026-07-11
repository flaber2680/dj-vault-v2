import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { registerDownloadAttempt } from "@/lib/downloads/store";
import {
  DEMO_COLLECTION_NUMBER,
  findCollectionByNumber,
} from "@/lib/content/collections";
import {
  createSignedDownloadUrl,
  getS3ConfigStatus,
  getS3ObjectMetadata,
} from "@/lib/storage/s3";

type RouteContext = {
  params: Promise<{
    number: string;
  }>;
};

function getAppBaseUrl(request: NextRequest) {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.AUTH_URL ??
    request.nextUrl.origin
  );
}

function redirectTo(path: string, request: NextRequest) {
  return NextResponse.redirect(new URL(path, getAppBaseUrl(request)));
}

function redirectToCollections(
  request: NextRequest,
  download: string,
  collectionNumber: string,
) {
  const url = new URL("/collections", getAppBaseUrl(request));

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

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      details:
        "details" in error
          ? (error as { details?: unknown }).details
          : undefined,
    };
  }

  return error;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const wantsJson = request.nextUrl.searchParams.get("format") === "json";
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
    if (wantsJson) {
      return NextResponse.json({ error: "not_configured" }, { status: 409 });
    }
    return redirectToCollections(request, "not_configured", collection.number);
  }

  let signedUrl: string;

  try {
    signedUrl = createSignedDownloadUrl(collection.s3Key);
  } catch (error) {
    console.error("[download] failed to create S3 signed URL", {
      collectionNumber: collection.number,
      s3Key: collection.s3Key,
      s3: getS3ConfigStatus(),
      error: serializeError(error),
    });

    if (wantsJson) {
      return NextResponse.json({ error: "storage" }, { status: 500 });
    }
    return redirectToCollections(request, "storage", collection.number);
  }

  try {
    await getS3ObjectMetadata(collection.s3Key);
  } catch (error) {
    console.error(
      "[download] S3 metadata check failed; redirecting to signed URL anyway",
      {
        collectionNumber: collection.number,
        s3Key: collection.s3Key,
        s3: getS3ConfigStatus(),
        error: serializeError(error),
      },
    );
  }

  const download = await registerDownloadAttempt({
    archiveId: collection.number,
    ipAddress: getClientIp(request),
    limit: collection.downloadLimit,
    userAgent: request.headers.get("user-agent") ?? "unknown",
    userId: user.id,
  });

  if (!download.allowed) {
    if (wantsJson) {
      return NextResponse.json(
        { error: "limit", remaining: 0 },
        { status: 429 },
      );
    }
    return redirectToCollections(request, "limit", collection.number);
  }

  if (wantsJson) {
    return NextResponse.json({
      downloadUrl: signedUrl,
      remaining: Math.max(
        0,
        collection.downloadLimit - download.record.downloadCount,
      ),
    });
  }

  return NextResponse.redirect(signedUrl);
}
