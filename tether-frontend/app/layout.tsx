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

const BASE_URL = "https://tether-frontend.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Tether — Creator Intelligence Platform",
    template: "%s — Tether",
  },
  description: "Connect your social accounts and share verified metrics with brands and agencies. Get discovered by top companies.",
  openGraph: {
    type: "website",
    siteName: "Tether",
    title: "Tether — Creator Intelligence Platform",
    description: "Connect your social accounts and share verified metrics with brands and agencies.",
    url: BASE_URL,
  },
  twitter: {
    card: "summary",
    title: "Tether — Creator Intelligence Platform",
    description: "Connect your social accounts and share verified metrics with brands and agencies.",
  },
  icons: {
    icon: "/favicon.svg",
  },
  themeColor: "#7c3aed",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
