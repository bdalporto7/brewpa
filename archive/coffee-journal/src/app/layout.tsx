import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Coffee Journal - Track Your Brewing Adventures",
  description: "A modern web application for coffee enthusiasts to record and track their brewing experiences, including brew methods, ratios, and tasting notes.",
  keywords: "coffee, brewing, journal, pour-over, espresso, coffee journal, brewing tracker",
  authors: [{ name: "Coffee Journal Team" }],
  viewport: "width=device-width, initial-scale=1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
