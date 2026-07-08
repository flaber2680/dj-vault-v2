import Link from "next/link";
import { legalLinks } from "@/lib/content/legal";

export function Footer() {
  return (
    <footer className="footer">
      <span>DJ Vault © 2026</span>

      <nav className="footer-links" aria-label="Правовая информация">
        {legalLinks.map((link) => (
          <Link href={link.href} key={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
