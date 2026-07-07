import type { PublicUser } from "@/lib/auth/store";

export const ADMIN_EMAIL = "flaber2680@gmail.com";

export function isAdminUser(user: PublicUser | null) {
  return user?.email.toLowerCase() === ADMIN_EMAIL;
}
