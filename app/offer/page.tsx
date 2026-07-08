import { Header } from "@/components/layout/Header";
import { ScrollEffects } from "@/components/ScrollEffects";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { legalPages } from "@/lib/content/legal";

export default function OfferPage() {
  return (
    <main className="page">
      <ScrollEffects />
      <Header />
      <LegalDocument content={legalPages.offer} />
    </main>
  );
}
