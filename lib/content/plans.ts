export type AccessPackageId = "days-30" | "days-90" | "days-180";
export type LegacyPackageId = "start" | "pro" | "premium";

export type AccessPackage = {
  id: AccessPackageId;
  durationDays: number;
  amount: number;
  price: string;
  oldPrice?: string;
  badge: string;
};

export const accessPackageList: AccessPackage[] = [
  {
    id: "days-30",
    durationDays: 30,
    amount: 1000,
    price: "1000 ₽",
    badge: "На месяц",
  },
  {
    id: "days-90",
    durationDays: 90,
    amount: 2700,
    price: "2700 ₽",
    oldPrice: "3000 ₽",
    badge: "Самый популярный",
  },
  {
    id: "days-180",
    durationDays: 180,
    amount: 4800,
    price: "4800 ₽",
    oldPrice: "6000 ₽",
    badge: "Максимальная выгода",
  },
];

const legacyPackageIds: Record<LegacyPackageId, AccessPackageId> = {
  start: "days-30",
  pro: "days-90",
  premium: "days-180",
};

export function getAccessPackage(id?: string | null) {
  if (!id) {
    return null;
  }

  const normalizedId =
    id in legacyPackageIds
      ? legacyPackageIds[id as LegacyPackageId]
      : id;

  return accessPackageList.find((item) => item.id === normalizedId) ?? null;
}
