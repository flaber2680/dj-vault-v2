import { NextResponse } from "next/server";
import { activateYooKassaPayment } from "@/lib/payments/activate";
import { getYooKassaPayment } from "@/lib/payments/yookassa";

type YooKassaWebhookPayload = {
  event?: string;
  object?: {
    id?: string;
  };
};

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as
    | YooKassaWebhookPayload
    | null;
  const paymentId = payload?.object?.id;

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
