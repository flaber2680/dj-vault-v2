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
      "Доступ ко всем архивам",
      "Еженедельные обновления",
      "Скачивание через Cloud Mail",
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
      "Доступ ко всем архивам",
      "Еженедельные обновления",
      "Скачивание через Cloud Mail",
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
      "Доступ ко всем архивам",
      "Еженедельные обновления",
      "Скачивание через Cloud Mail",
    ],
  },
];

export function getPaidPlan(plan?: string | null) {
  return paidPlanList.find((item) => item.id === plan) ?? null;
}
