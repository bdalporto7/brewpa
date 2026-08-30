import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist_Mono, Permanent_Marker } from "next/font/google";
import Nav from "@/components/Nav";
import ToastProvider from "@/components/ui/ToastProvider";
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

// viewportFit: "cover" lets the WebView draw edge-to-edge under the
// notch/Dynamic Island and home indicator — required before any
// env(safe-area-inset-*) CSS (used by Nav's header and its fixed bottom
// tab bar) resolves to anything but 0. Doesn't matter in regular mobile
// Safari (the browser chrome already reserves that space), only shows up
// once the app runs edge-to-edge as its own native shell via Capacitor.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${marker.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <Nav />
          {/* Extra bottom padding on mobile only — clears the fixed bottom
              tab bar NavClient renders below sm:, so the last bit of page
              content isn't hidden behind it. */}
          <main className="mx-auto w-full max-w-4xl flex-1 px-4 pt-8 pb-24 sm:px-6 sm:pb-8">
            {children}
          </main>
        </ToastProvider>
      </body>
    </html>
  );
}
