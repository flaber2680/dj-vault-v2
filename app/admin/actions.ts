"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdminUser } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { resetDownloadLimit } from "@/lib/downloads/store";
import { saveCollection } from "@/lib/content/collections";
import { createPromoCodeForUser } from "@/lib/referrals/store";
import {
  calculateAdminAccessChange,
  type AccessPlan,
} from "@/lib/access/subscription";
import { findUserById, updateUserPlan } from "@/lib/auth/store";

function getField(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

export async function saveCollectionAction(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!isAdminUser(user)) {
    redirect("/account");
  }

  const number = getField(formData, "number");
  const date = getField(formData, "date");
  const tracks = getField(formData, "tracks");
  const genres = getField(formData, "genres");
  const description = getField(formData, "description");
  const s3Key = getField(formData, "s3Key");
  const downloadLimit = getField(formData, "downloadLimit");
  const isActive = formData.get("isActive") === "on";

  if (
    !number.trim() ||
    !date.trim() ||
    !tracks.trim() ||
    !genres.trim()
  ) {
    redirect("/admin?error=required");
  }

  const collection = await saveCollection({
    number,
    date,
    tracks,
    genres,
    description,
    s3Key,
    downloadLimit,
    isActive,
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/collections");
  redirect(`/admin?saved=${encodeURIComponent(collection.number)}`);
}

export async function resetDownloadLimitAction(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!isAdminUser(user)) {
    redirect("/account");
  }

  const userId = getField(formData, "userId");
  const archiveId = getField(formData, "archiveId");

  if (!userId.trim() || !archiveId.trim()) {
    redirect("/admin?error=reset_required");
  }

  await resetDownloadLimit(userId, archiveId);
  revalidatePath("/admin");
  redirect(`/admin?reset=${encodeURIComponent(archiveId)}`);
}

export async function createPromoCodeAction(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!isAdminUser(user)) {
    redirect("/account");
  }

  const userId = getField(formData, "userId");
  const code = getField(formData, "code");

  if (!userId.trim() || !code.trim()) {
    redirect("/admin?promo_error=required#users");
  }

  try {
    const promoCode = await createPromoCodeForUser({
      code,
      ownerUserId: userId,
    });

    revalidatePath("/admin");
    redirect(`/admin?promo=${encodeURIComponent(promoCode.code)}#promo-codes`);
  } catch (error) {
    if ((error as Error).message === "PROMO_CODE_EXISTS") {
      redirect("/admin?promo_error=exists#users");
    }

    redirect("/admin?promo_error=unknown#users");
  }
}

export async function updateUserAccessAction(formData: FormData) {
  const admin = await getCurrentUser();

  if (!admin) {
    redirect("/login");
  }

  if (!isAdminUser(admin)) {
    redirect("/account");
  }

  const userId = getField(formData, "userId").trim();
  const accessPlan = getField(formData, "accessPlan") as AccessPlan;
  const daysValue = getField(formData, "days").trim();
  const days = daysValue ? Number(daysValue) : 0;

  if (!userId || (accessPlan !== "free" && accessPlan !== "club")) {
    redirect("/admin?access_error=required#users");
  }

  const targetUser = await findUserById(userId);

  if (!targetUser) {
    redirect("/admin?access_error=not_found#users");
  }

  let change: ReturnType<typeof calculateAdminAccessChange>;

  try {
    change = calculateAdminAccessChange({
      currentPlan: targetUser.plan,
      currentExpiresAt: targetUser.planExpiresAt,
      nextPlan: accessPlan,
      days,
    });
  } catch (error) {
    const code = (error as Error).message;

    if (code === "ACCESS_DAYS_REQUIRED") {
      redirect("/admin?access_error=days_required#users");
    }

    if (code === "ACCESS_DAYS_NOT_ALLOWED") {
      redirect("/admin?access_error=days_not_allowed#users");
    }

    redirect("/admin?access_error=invalid_days#users");
  }

  await updateUserPlan(
    targetUser.id,
    change.plan,
    change.planExpiresAt,
  );

  revalidatePath("/admin");
  revalidatePath("/account");
  revalidatePath("/collections");
  redirect(`/admin?access_updated=${encodeURIComponent(targetUser.email)}#users`);
}
