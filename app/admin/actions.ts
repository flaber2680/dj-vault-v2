"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdminUser } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { resetDownloadLimit } from "@/lib/downloads/store";
import { saveCollection } from "@/lib/content/collections";
import { createPromoCodeForUser } from "@/lib/referrals/store";
import {
  type AccessPlan,
} from "@/lib/access/subscription";
import { applyAdminAccessChange } from "@/lib/auth/store";

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
    redirect("/admin?section=collections&collection=new&error=required");
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
  redirect(`/admin?section=collections&saved=${encodeURIComponent(collection.number)}`);
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
    redirect("/admin?section=users&error=reset_required");
  }

  await resetDownloadLimit(userId, archiveId);
  revalidatePath("/admin");
  redirect(`/admin?section=users&user=${encodeURIComponent(userId)}&reset=${encodeURIComponent(archiveId)}`);
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
    redirect("/admin?section=users&promo_error=required");
  }

  try {
    const promoCode = await createPromoCodeForUser({
      code,
      ownerUserId: userId,
    });

    revalidatePath("/admin");
    redirect(`/admin?section=users&user=${encodeURIComponent(userId)}&promo=${encodeURIComponent(promoCode.code)}`);
  } catch (error) {
    if ((error as Error).message === "PROMO_CODE_EXISTS") {
      redirect(`/admin?section=users&user=${encodeURIComponent(userId)}&promo_error=exists`);
    }

    redirect(`/admin?section=users&user=${encodeURIComponent(userId)}&promo_error=unknown`);
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
    redirect("/admin?section=users&access_error=required");
  }

  let targetUser: Awaited<ReturnType<typeof applyAdminAccessChange>>;

  try {
    targetUser = await applyAdminAccessChange(userId, accessPlan, days);
  } catch (error) {
    const code = (error as Error).message;

    if (code === "USER_NOT_FOUND") {
      redirect("/admin?section=users&access_error=not_found");
    }

    if (code === "ACCESS_DAYS_REQUIRED") {
      redirect(`/admin?section=users&user=${encodeURIComponent(userId)}&access_error=days_required`);
    }

    if (code === "ACCESS_DAYS_NOT_ALLOWED") {
      redirect(`/admin?section=users&user=${encodeURIComponent(userId)}&access_error=days_not_allowed`);
    }

    redirect(`/admin?section=users&user=${encodeURIComponent(userId)}&access_error=invalid_days`);
  }

  revalidatePath("/admin");
  revalidatePath("/account");
  revalidatePath("/collections");
  redirect(`/admin?section=users&user=${encodeURIComponent(targetUser.id)}&access_updated=${encodeURIComponent(targetUser.email)}`);
}
