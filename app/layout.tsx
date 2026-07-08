import "./globals.css";
import { CursorGlow } from "@/components/CursorGlow";
import { Footer } from "@/components/layout/Footer";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="bg-black text-white min-h-screen overflow-x-hidden">
        <CursorGlow />
        {children}
        <Footer />
      </body>
    </html>
  );
}
