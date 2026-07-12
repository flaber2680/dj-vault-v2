import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { ScrollEffects } from "@/components/ScrollEffects";
import { Hero } from "@/components/sections/Hero";
import { LibraryBlocks } from "@/components/sections/LibraryBlocks";
import { getCurrentUser } from "@/lib/auth/session";
import { hasClubAccess } from "@/lib/access/subscription";

export default async function Home() {
  const user = await getCurrentUser();

  if (user && hasClubAccess(user)) {
    redirect("/collections");
  }

  return (
    <main className="page">
      <ScrollEffects />
      <Header />
      <Hero />
      <LibraryBlocks />
    </main>
  );
}
