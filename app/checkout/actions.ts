"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { updateUserPlan } from "@/lib/auth/store";
import { getPaidPlan } from "@/lib/content/plans";

const dayInMs = 24 * 60 * 60 * 1000;

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

export async function completeCheckout(formData: FormData) {
  const user = await getCurrentUser();
  const plan = getPaidPlan(formValue(formData, "plan"));

  if (!user) {
    redirect("/register");
  }

  if (!plan) {
    redirect("/pricing");
  }

  const currentExpirationTime = user.planExpiresAt
    ? Date.parse(user.planExpiresAt)
    : 0;
  const startsAt =
    Number.isFinite(currentExpirationTime) && currentExpirationTime > Date.now()
      ? currentExpirationTime
      : Date.now();
  const planExpiresAt = new Date(startsAt + plan.durationDays * dayInMs).toISOString();
  const nextPlan = user.plan !== "free" ? user.plan : plan.id;

  await updateUserPlan(user.id, nextPlan, planExpiresAt);
  redirect("/collections");
}
