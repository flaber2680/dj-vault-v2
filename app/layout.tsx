import "./globals.css";
import type { Metadata } from "next";
import { CursorGlow } from "@/components/CursorGlow";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: {
    default: "DJ Vault",
    template: "%s | DJ Vault",
  },
  description:
    "DJ Vault - закрытый клуб с тщательно отобранными подборками музыки для диджеев.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://djvault.ru"),
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="bg-black text-white min-h-screen">
        <CursorGlow />
        {children}
        <Footer />
      </body>
    </html>
  );
}
