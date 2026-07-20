import { Header } from "@/components/layout/Header";
import { ScrollEffects } from "@/components/ScrollEffects";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { legalPages } from "@/lib/content/legal";

export const metadata = {
  title: "Условия использования",
};

export default function TermsPage() {
  return (
    <main className="page">
      <ScrollEffects />
      <Header />
      <LegalDocument content={legalPages.terms} />
    </main>
  );
}
