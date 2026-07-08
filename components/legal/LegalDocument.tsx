import Link from "next/link";
import type { LegalPageContent } from "@/lib/content/legal";

type LegalDocumentProps = {
  content: LegalPageContent;
};

export function LegalDocument({ content }: LegalDocumentProps) {
  return (
    <section className="legal-page">
      <article className="legal-document" data-reveal>
        <div className="section-kicker">
          <span>Документ</span>
          <span>{content.kicker}</span>
        </div>

        <h1>{content.title}</h1>
        <p className="legal-lead">{content.lead}</p>

        <div className="legal-updated">Редакция от {content.updatedAt}</div>

        {content.sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>

            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}

        <div className="legal-actions">
          <Link className="button-main" href="/">
            <span className="button-label">На главную</span>
          </Link>
        </div>
      </article>
    </section>
  );
}
