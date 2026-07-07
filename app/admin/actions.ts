"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdminUser } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/auth/session";
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
  const size = getField(formData, "size");
  const tracks = getField(formData, "tracks");
  const genres = getField(formData, "genres");
  const description = getField(formData, "description");
  const downloadUrl = getField(formData, "downloadUrl");

  if (
    !number.trim() ||
    !date.trim() ||
    !size.trim() ||
    !tracks.trim() ||
    !genres.trim()
  ) {
    redirect("/admin?error=required");
  }

  const collection = await saveCollection({
    number,
    date,
    size,
    tracks,
    genres,
    description,
    downloadUrl,
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/collections");
  redirect(`/admin?saved=${encodeURIComponent(collection.number)}`);
}
