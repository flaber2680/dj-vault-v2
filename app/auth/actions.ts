"use server";

import { signOut } from "@/auth";
import { redirect } from "next/navigation";
import {
  findUserByEmail,
  registerEmailUserWithReferral,
  verifyPassword,
} from "@/lib/auth/store";
import { hasClubAccess } from "@/lib/access/subscription";
import {
  requestPasswordReset,
  resetPasswordByToken,
} from "@/lib/auth/password-reset";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth/session";
import { normalizeAuthReturnPath } from "@/lib/auth/return-path";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function redirectWithError(
  path: "/login" | "/register",
  error: string,
  returnTo?: string,
): never {
  const params = new URLSearchParams({ error });

  if (returnTo) {
    params.set("next", returnTo);
  }

  redirect(`${path}?${params.toString()}`);
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
  const returnTo = normalizeAuthReturnPath(formValue(formData, "returnTo"));

  if (!email.includes("@") || password.length < 10) {
    redirectWithError("/register", "invalid_register", returnTo);
  }

  try {
    const user = await registerEmailUserWithReferral({
      email,
      password,
      name,
      promoCode: promoCode || undefined,
    });

    await setSessionCookie(user.id);
  } catch (error) {
    if ((error as Error).message === "USER_EXISTS") {
      redirectWithError("/register", "user_exists", returnTo);
    }

    if (
      (error as Error).message === "PROMO_CODE_NOT_FOUND" ||
      (error as Error).message === "PROMO_CODE_SELF_REFERRAL"
    ) {
      redirectWithError("/register", "invalid_promo", returnTo);
    }

    redirectWithError("/register", "unknown", returnTo);
  }

  redirect(returnTo ?? "/account");
}

export async function loginWithEmail(formData: FormData) {
  const email = formValue(formData, "email");
  const password = formValue(formData, "password");
  const returnTo = normalizeAuthReturnPath(formValue(formData, "returnTo"));

  const user = await findUserByEmail(email);
  const isValidPassword = await verifyPassword(password, user?.passwordHash);

  if (!user || !isValidPassword) {
    redirectWithError("/login", "invalid_login", returnTo);
  }

  await setSessionCookie(user.id);
  redirect(returnTo ?? (hasClubAccess(user) ? "/collections" : "/account"));
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = formValue(formData, "email");
  const params = new URLSearchParams({ sent: "1" });

  if (email.includes("@")) {
    try {
      await requestPasswordReset(email);
    } catch {
      console.error("PASSWORD_RESET_REQUEST_FAILED");
    }
  }

  redirect(`/forgot-password?${params.toString()}`);
}

export async function resetPasswordAction(formData: FormData) {
  const token = formValue(formData, "token");
  const password = formValue(formData, "password");

  if (!token) {
    redirectToPasswordReset("invalid");
  }

  if (password.length < 10) {
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
