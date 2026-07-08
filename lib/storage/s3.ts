import { createHmac, createHash } from "crypto";

type S3Config = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  addressingStyle: "path-style" | "virtual-hosted";
};

export type S3ObjectMetadata = {
  contentLength?: number;
  contentType?: string;
  lastModified?: string;
};

export class S3RequestError extends Error {
  constructor(
    message: string,
    public readonly details: {
      key: string;
      method: "GET" | "HEAD";
      status?: number;
      statusText?: string;
      body?: string;
    },
  ) {
    super(message);
    this.name = "S3RequestError";
  }
}

const defaultSignedUrlTtl = 15 * 60;

function getS3Config(): S3Config | null {
  const endpoint = process.env.S3_ENDPOINT?.replace(/\/$/, "");
  const region = process.env.S3_REGION;
  const bucket = process.env.S3_BUCKET;
  const accessKey = process.env.S3_ACCESS_KEY;
  const secretKey = process.env.S3_SECRET_KEY;
  const addressingStyle =
    process.env.S3_ADDRESSING_STYLE === "path-style"
      ? "path-style"
      : "virtual-hosted";

  if (!endpoint || !region || !bucket || !accessKey || !secretKey) {
    return null;
  }

  return {
    endpoint,
    region,
    bucket,
    accessKey,
    secretKey,
    addressingStyle,
  };
}

export function getS3ConfigStatus() {
  const config = getS3Config();

  if (!config) {
    return {
      configured: false,
      endpoint: process.env.S3_ENDPOINT?.replace(/\/$/, "") ?? null,
      region: process.env.S3_REGION ?? null,
      bucket: process.env.S3_BUCKET ?? null,
      addressingStyle: process.env.S3_ADDRESSING_STYLE ?? null,
      hasAccessKey: Boolean(process.env.S3_ACCESS_KEY),
      hasSecretKey: Boolean(process.env.S3_SECRET_KEY),
    };
  }

  return {
    configured: true,
    endpoint: config.endpoint,
    region: config.region,
    bucket: config.bucket,
    addressingStyle: config.addressingStyle,
    hasAccessKey: true,
    hasSecretKey: true,
  };
}

function encodePathSegment(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodeQueryValue(value: string) {
  return encodePathSegment(value);
}

function normalizeS3Key(key: string) {
  return key
    .trim()
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean)
    .join("/");
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function getSigningKey(secretKey: string, date: string, region: string) {
  const dateKey = hmac(`AWS4${secretKey}`, date);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, "s3");

  return hmac(serviceKey, "aws4_request");
}

function getAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function getDateStamp(date: Date) {
  return getAmzDate(date).slice(0, 8);
}

function createPresignedUrl({
  expiresIn = defaultSignedUrlTtl,
  key,
  method,
}: {
  expiresIn?: number;
  key: string;
  method: "GET" | "HEAD";
}) {
  const config = getS3Config();

  if (!config) {
    throw new Error("S3_CONFIG_MISSING");
  }

  const normalizedKey = normalizeS3Key(key);

  if (!normalizedKey) {
    throw new Error("S3_KEY_MISSING");
  }

  const now = new Date();
  const amzDate = getAmzDate(now);
  const dateStamp = getDateStamp(now);
  const endpointUrl = new URL(config.endpoint);
  const objectPath = normalizedKey.split("/").map(encodePathSegment).join("/");
  const isVirtualHosted = config.addressingStyle === "virtual-hosted";
  const host = isVirtualHosted
    ? `${config.bucket}.${endpointUrl.host}`
    : endpointUrl.host;
  const canonicalUri = isVirtualHosted
    ? `/${objectPath}`
    : `/${encodePathSegment(config.bucket)}/${objectPath}`;
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const queryParams = new Map<string, string>([
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${config.accessKey}/${credentialScope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expiresIn)],
    ["X-Amz-SignedHeaders", "host"],
  ]);
  const canonicalQuery = Array.from(queryParams.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([keyName, value]) => `${encodeQueryValue(keyName)}=${encodeQueryValue(value)}`)
    .join("&");
  const canonicalHeaders = `host:${host}\n`;
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");
  const signature = createHmac(
    "sha256",
    getSigningKey(config.secretKey, dateStamp, config.region),
  )
    .update(stringToSign)
    .digest("hex");
  const signedUrl = new URL(`${endpointUrl.protocol}//${host}${canonicalUri}`);

  for (const [keyName, value] of queryParams) {
    signedUrl.searchParams.set(keyName, value);
  }

  signedUrl.searchParams.set("X-Amz-Signature", signature);

  return signedUrl.toString();
}

export function createSignedDownloadUrl(key: string, expiresIn = defaultSignedUrlTtl) {
  return createPresignedUrl({
    expiresIn,
    key,
    method: "GET",
  });
}

export async function getS3ObjectMetadata(
  key: string,
): Promise<S3ObjectMetadata | null> {
  const url = createPresignedUrl({
    expiresIn: 60,
    key,
    method: "HEAD",
  });
  const response = await fetch(url, {
    method: "HEAD",
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");

    throw new S3RequestError("S3_HEAD_FAILED", {
      key,
      method: "HEAD",
      status: response.status,
      statusText: response.statusText,
      body: body.slice(0, 500),
    });
  }

  const contentLength = Number(response.headers.get("content-length"));

  return {
    contentLength: Number.isFinite(contentLength) ? contentLength : undefined,
    contentType: response.headers.get("content-type") ?? undefined,
    lastModified: response.headers.get("last-modified") ?? undefined,
  };
}

export function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) {
    return "";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = value >= 10 || unitIndex === 0 ? 0 : 2;

  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}
