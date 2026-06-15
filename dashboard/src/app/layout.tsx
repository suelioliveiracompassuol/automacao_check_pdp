import type { Metadata } from "next";
import "./globals.css";
import { NavHeader } from "@/components/nav-header";

export const metadata: Metadata = {
  title: "PDP Monitor Dashboard",
  description: "Monitoramento de features em PDPs Natura/Avon",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-[var(--color-bg)]">
        <NavHeader />
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
