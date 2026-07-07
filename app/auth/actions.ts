"use server";

import { signIn, signOut } from "@/auth";
import { redirect } from "next/navigation";
import {
  createUserWithEmail,
  findUserByEmail,
  verifyPassword,
} from "@/lib/auth/store";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth/session";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function redirectWithError(path: "/login" | "/register", error: string): never {
  redirect(`${path}?error=${encodeURIComponent(error)}`);
}

export async function registerWithEmail(formData: FormData) {
  const name = formValue(formData, "name");
  const email = formValue(formData, "email");
  const password = formValue(formData, "password");

  if (!email.includes("@") || password.length < 6) {
    redirectWithError("/register", "invalid_register");
  }

  try {
    const user = await createUserWithEmail({ email, password, name });
    await setSessionCookie(user.id);
  } catch (error) {
    if ((error as Error).message === "USER_EXISTS") {
      redirectWithError("/register", "user_exists");
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
  redirect(user.plan && user.plan !== "free" ? "/collections" : "/account");
}

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/account" });
}

export async function logout() {
  await clearSessionCookie();
  await signOut({ redirectTo: "/" });
}
