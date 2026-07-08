import { randomUUID } from "crypto";
import type { PaymentMethod } from "@/lib/payments/store";

const yookassaApiUrl = "https://api.yookassa.ru/v3";

export type YooKassaPayment = {
  id: string;
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  paid: boolean;
  amount: {
    value: string;
    currency: string;
  };
  confirmation?: {
    type: string;
    confirmation_url?: string;
    return_url?: string;
  };
  payment_method?: {
    type?: string;
  };
  metadata?: Record<string, string | undefined>;
};

type CreateYooKassaPaymentInput = {
  amount: number;
  description: string;
  method: PaymentMethod;
  returnUrl: string;
  metadata: Record<string, string>;
};

export class YooKassaConfigError extends Error {
  constructor() {
    super("YOOKASSA_CONFIG_MISSING");
  }
}

export class YooKassaRequestError extends Error {
  constructor(
    public status: number,
    public details: unknown,
  ) {
    super("YOOKASSA_REQUEST_FAILED");
  }
}

function getYooKassaConfig() {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;

  if (!shopId || !secretKey) {
    throw new YooKassaConfigError();
  }

  return { shopId, secretKey };
}

export function getAppUrl() {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? "https://djvault.ru";

  return appUrl.replace(/\/$/, "");
}

function getAuthHeader() {
  const { shopId, secretKey } = getYooKassaConfig();
  const token = Buffer.from(`${shopId}:${secretKey}`).toString("base64");

  return `Basic ${token}`;
}

async function readYooKassaResponse(response: Response) {
  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new YooKassaRequestError(response.status, data);
  }

  return data as YooKassaPayment;
}

export async function createYooKassaPayment(input: CreateYooKassaPaymentInput) {
  const response = await fetch(`${yookassaApiUrl}/payments`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
      "Idempotence-Key": randomUUID(),
    },
    body: JSON.stringify({
      amount: {
        value: input.amount.toFixed(2),
        currency: "RUB",
      },
      payment_method_data: {
        type: input.method,
      },
      confirmation: {
        type: "redirect",
        return_url: input.returnUrl,
      },
      capture: true,
      description: input.description.slice(0, 128),
      metadata: input.metadata,
    }),
    cache: "no-store",
  });

  return readYooKassaResponse(response);
}

export async function getYooKassaPayment(paymentId: string) {
  const response = await fetch(
    `${yookassaApiUrl}/payments/${encodeURIComponent(paymentId)}`,
    {
      method: "GET",
      headers: {
        Authorization: getAuthHeader(),
      },
      cache: "no-store",
    },
  );

  return readYooKassaResponse(response);
}
