"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdminUser } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { resetDownloadLimit } from "@/lib/downloads/store";
import { saveCollection } from "@/lib/content/collections";

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
