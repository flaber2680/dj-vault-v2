const supportedYooKassaPaymentEvents = new Set([
  "payment.succeeded",
  "payment.canceled",
]);

export function getYooKassaWebhookPaymentId(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const event = "event" in payload ? payload.event : null;
  const object = "object" in payload ? payload.object : null;

  if (
    typeof event !== "string" ||
    !supportedYooKassaPaymentEvents.has(event) ||
    !object ||
    typeof object !== "object" ||
    !("id" in object) ||
    typeof object.id !== "string" ||
    !object.id.trim()
  ) {
    return null;
  }

  return object.id;
}
