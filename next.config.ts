import type { NextConfig } from "next";

function getS3FrameSource() {
  const endpoint = process.env.S3_ENDPOINT;

  if (!endpoint) {
    return null;
  }

  try {
    const endpointUrl = new URL(endpoint);

    if (endpointUrl.protocol !== "https:" && endpointUrl.protocol !== "http:") {
      return null;
    }

    if (process.env.S3_ADDRESSING_STYLE !== "path-style") {
      const bucket = process.env.S3_BUCKET;

      if (!bucket) {
        return null;
      }

      endpointUrl.hostname = `${bucket}.${endpointUrl.hostname}`;
    }

    return endpointUrl.origin;
  } catch {
    return null;
  }
}

const s3FrameSource = getS3FrameSource();
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self'",
  "frame-src 'self'" + (s3FrameSource ? ` ${s3FrameSource}` : ""),
  "frame-ancestors 'none'",
  "form-action 'self' https://yookassa.ru",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
];

if (process.env.NODE_ENV === "production") {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  });
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
