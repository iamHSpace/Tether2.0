import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

/**
 * next/font/google downloads Inter at build time and self-hosts it.
 * The browser never makes a runtime request to fonts.googleapis.com.
 */
const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Tether — Creator Intelligence Platform",
  description: "Connect your social accounts and share verified metrics with brands and agencies.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
