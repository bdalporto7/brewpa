import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist_Mono } from "next/font/google";
import ToastProvider from "@/components/ui/ToastProvider";
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
  title: "Cybar Coffee — Drop",
  description: "Enter a drop code to place a pre-order.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * A second, independent root layout (own <html>/<body>) — not nested
 * under the main app's — so a visitor here never gets the Nav header, the
 * app's own max-width/padding shell, or a single link back into the rest
 * of the app, regardless of whether they happen to be signed in as the
 * admin in the same browser. Next.js's "multiple root layouts" pattern:
 * this only works because src/app/layout.tsx doesn't exist — every
 * top-level route group provides its own full root instead of sharing one.
 */
export default function DropLayout({ children }: LayoutProps<"/drop">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
