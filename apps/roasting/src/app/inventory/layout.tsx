import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Bricolage_Grotesque, Geist_Mono } from "next/font/google";
import ToastProvider from "@/components/ui/ToastProvider";
import InvNav from "@/components/inventory/InvNav";
import "../globals.css";

const geistSans = Bricolage_Grotesque({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Green Coffee Inventory",
  description: "Green coffee lots, roast log, planning, and true cost per bag.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * The inventory app's own root layout — an independent root (own
 * <html>/<body>), not nested under the roasting app's. It gets its own
 * header and flat nav, and exactly one link back to the roasting app.
 * Next.js "multiple root layouts": this works because
 * src/app/layout.tsx doesn't exist — every top-level route provides its
 * own full root instead of sharing one.
 */
export default function InventoryLayout({ children }: LayoutProps<"/inventory">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ToastProvider>
          <div className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
            <header className="flex items-center justify-between gap-4 border-b-2 border-[var(--border-strong)] py-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-muted">Green coffee</p>
                <h1 className="text-xl font-bold tracking-tight">Inventory</h1>
              </div>
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Roaster
              </Link>
            </header>
            <div className="mt-3">
              <InvNav />
            </div>
            <main className="mt-6">{children}</main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
