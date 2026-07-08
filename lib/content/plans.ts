import type { TariffPlan } from "@/lib/auth/store";

export type PaidPlan = Exclude<TariffPlan, "free">;

export type PaidPlanDetails = {
  id: PaidPlan;
  name: string;
  period: string;
  price: string;
  amount: number;
  durationDays: number;
  oldPrice?: string;
  badge: string;
  features: string[];
};

export const paidPlanList: PaidPlanDetails[] = [
  {
    id: "start",
    name: "Start",
    period: "1 месяц",
    price: "1000 ₽",
    amount: 1000,
    durationDays: 30,
    badge: "Для знакомства",
    features: [
      "Доступ на 30 дней",
      "Еженедельные обновления",
      "Закрытые DJ-подборки",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    period: "3 месяца",
    price: "2700 ₽",
    amount: 2700,
    durationDays: 90,
    oldPrice: "3000 ₽",
    badge: "Самый популярный",
    features: [
      "Доступ на 3 месяца",
      "Еженедельные обновления",
      "Клубные подборки DJ Vault",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    period: "6 месяцев",
    price: "4800 ₽",
    amount: 4800,
    durationDays: 180,
    oldPrice: "6000 ₽",
    badge: "Максимальная выгода",
    features: [
      "Доступ на 6 месяцев",
      "Еженедельные обновления",
      "Клубные выпуски и подборки",
    ],
  },
];

export function getPaidPlan(plan?: string | null) {
  return paidPlanList.find((item) => item.id === plan) ?? null;
}
