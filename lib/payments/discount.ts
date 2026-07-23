export function calculateDiscountedAmount(amount: number, percent: number): number {
  return Math.round(amount * (100 - percent)) / 100;
}

export function formatRub(amount: number): string {
  return `${amount} ₽`;
}
