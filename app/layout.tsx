import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/navigation";
import { SiteFooter } from "@/components/footer";
import { CommandPalette } from "@/components/command-palette";
import { Dateline } from "@/components/dateline";
import { getCommandPaletteIndex, getLastUpdatedDate } from "@/lib/db";

export const metadata: Metadata = {
  title: "Federal AI Use Case Inventory 2025",
  description:
    "Dashboard for the 2025 Federal AI Use Case Inventory — agencies, use cases, products, and templates mandated by OMB M-25-21.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const paletteIndex = getCommandPaletteIndex();
  const lastUpdated = getLastUpdatedDate();

  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-background text-foreground paper-grain">
        <Dateline lastUpdated={lastUpdated} />
        <Navigation />
        <main className="flex flex-1 flex-col">{children}</main>
        <SiteFooter lastUpdated={lastUpdated} />
        <CommandPalette index={paletteIndex} />
      </body>
    </html>
  );
}
