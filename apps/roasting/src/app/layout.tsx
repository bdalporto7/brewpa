import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist_Mono, Permanent_Marker } from "next/font/google";
import Nav from "@/components/Nav";
import "./globals.css";

const geistSans = Bricolage_Grotesque({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Wordmark only — the live "Cybar" text in the nav (login's wordmark is
// baked into the logo image itself, not live text). An actual marker-style
// face, not just a metaphor, tying the brand text directly to the mascot's
// sharpie linework. Everything else (all real UI/data) stays on Geist —
// see AGENTS.md's "Brand identity" section.
const marker = Permanent_Marker({
  variable: "--font-permanent-marker",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cybar Coffee",
  description: "Roasting and brewing, tracked end to end.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${marker.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Nav />
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
          {children}
        </main>
      </body>
    </html>
  );
}
