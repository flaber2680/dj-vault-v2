import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="bg-black text-white min-h-screen overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}