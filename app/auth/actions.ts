"use server";

import { signOut } from "@/auth";
import { redirect } from "next/navigation";
import {
  createUserWithEmail,
  findUserByEmail,
  verifyPassword,
} from "@/lib/auth/store";
import { hasClubAccess } from "@/lib/access/subscription";
import {
  requestPasswordReset,
  resetPasswordByToken,
} from "@/lib/auth/password-reset";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth/session";
import {
  findActivePromoCode,
  recordPromoRegistration,
} from "@/lib/referrals/store";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function redirectWithError(path: "/login" | "/register", error: string): never {
  redirect(`${path}?error=${encodeURIComponent(error)}`);
}

function redirectToPasswordReset(error: string, token?: string): never {
  const params = new URLSearchParams({ error });

  if (token) {
    params.set("token", token);
  }

  redirect(`/reset-password?${params.toString()}`);
}

export async function registerWithEmail(formData: FormData) {
  const name = formValue(formData, "name");
  const email = formValue(formData, "email");
  const password = formValue(formData, "password");
  const promoCode = formValue(formData, "promoCode");

  if (!email.includes("@") || password.length < 6) {
    redirectWithError("/register", "invalid_register");
  }

  if (promoCode) {
    const activePromoCode = await findActivePromoCode(promoCode);

    if (!activePromoCode) {
      redirectWithError("/register", "invalid_promo");
    }
  }

  try {
    const user = await createUserWithEmail({ email, password, name });

    if (promoCode) {
      await recordPromoRegistration({
        promoCode,
        referredUserId: user.id,
      });
    }

    await setSessionCookie(user.id);
  } catch (error) {
    if ((error as Error).message === "USER_EXISTS") {
      redirectWithError("/register", "user_exists");
    }

    if (
      (error as Error).message === "PROMO_CODE_NOT_FOUND" ||
      (error as Error).message === "PROMO_CODE_SELF_REFERRAL"
    ) {
      redirectWithError("/register", "invalid_promo");
    }

    redirectWithError("/register", "unknown");
  }

  redirect("/account");
}

export async function loginWithEmail(formData: FormData) {
  const email = formValue(formData, "email");
  const password = formValue(formData, "password");

  const user = await findUserByEmail(email);
  const isValidPassword = await verifyPassword(password, user?.passwordHash);

  if (!user || !isValidPassword) {
    redirectWithError("/login", "invalid_login");
  }

  await setSessionCookie(user.id);
  redirect(hasClubAccess(user) ? "/collections" : "/account");
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = formValue(formData, "email");
  const params = new URLSearchParams({ sent: "1" });

  if (email.includes("@")) {
    await requestPasswordReset(email);
    params.set("email", email);
  }

  redirect(`/forgot-password?${params.toString()}`);
}

export async function resetPasswordAction(formData: FormData) {
  const token = formValue(formData, "token");
  const password = formValue(formData, "password");

  if (!token) {
    redirectToPasswordReset("invalid");
  }

  if (password.length < 6) {
    redirectToPasswordReset("short_password", token);
  }

  try {
    await resetPasswordByToken(token, password);
  } catch {
    redirectToPasswordReset("invalid", token);
  }

  redirect("/login?reset=success");
}

export async function logout() {
  await clearSessionCookie();
  await signOut({ redirectTo: "/" });
}
