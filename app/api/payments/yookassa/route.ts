import { NextResponse } from "next/server";
import { activateYooKassaPayment } from "@/lib/payments/activate";
import { getYooKassaPayment } from "@/lib/payments/yookassa";
import { getYooKassaWebhookPaymentId } from "@/lib/payments/webhook";
import { getNetworkRateLimitSubject } from "@/lib/security/client-key";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const rateLimit = consumeRateLimit({
    scope: "yookassa-webhook:ip",
    subject: getNetworkRateLimitSubject(request.headers),
    limit: 120,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "rate_limit" },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const payload = (await request.json().catch(() => null)) as unknown;
  const paymentId = getYooKassaWebhookPaymentId(payload);

  if (!paymentId) {
    return NextResponse.json({ ok: true });
  }

  try {
    const payment = await getYooKassaPayment(paymentId);

    await activateYooKassaPayment(payment);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("YooKassa webhook failed", error);

    return NextResponse.json(
      { ok: false, error: "WEBHOOK_PROCESSING_FAILED" },
      { status: 500 },
    );
  }
}
