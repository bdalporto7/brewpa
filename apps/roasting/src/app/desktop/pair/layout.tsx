import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist_Mono } from "next/font/google";
import "../../globals.css";

const geistSans = Bricolage_Grotesque({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cybar Coffee — Pair Desktop App",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/**
 * A second, independent root layout (own <html>/<body>), same pattern as
 * src/app/drop's — this is a page someone lands on once, from a system
 * browser a desktop install just opened, not a page anyone navigates to
 * from inside the app itself. No Nav, no app chrome.
 */
export default function DesktopPairLayout({ children }: LayoutProps<"/desktop/pair">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
