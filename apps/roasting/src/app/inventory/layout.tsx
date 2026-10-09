import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Geist, Geist_Mono } from "next/font/google";
import ToastProvider from "@/components/ui/ToastProvider";
import InvNav from "@/components/inventory/InvNav";
import "../globals.css";
import "./inventory.css";

const geistSans = Geist({
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
      <body className="inv min-h-full">
        <ToastProvider>
          <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-xl">
            <div className="mx-auto max-w-4xl px-4 pt-4 pb-3 sm:px-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <span aria-hidden className="inv-eyebrow-dot h-2 w-2 rounded-full bg-accent" />
                  <h1 className="text-lg font-semibold tracking-tight">Green Coffee</h1>
                </div>
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-muted transition hover:border-accent/50 hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Roaster
                </Link>
              </div>
              <div className="mt-3">
                <InvNav />
              </div>
            </div>
          </header>
          <main className="mx-auto mt-8 max-w-4xl px-4 pb-20 sm:px-6">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
