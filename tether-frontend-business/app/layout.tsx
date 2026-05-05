import type { Metadata } from "next";
import "./globals.css";

const BASE_URL = "https://tether-frontend-business.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Tether for Business",
    template: "%s — Tether for Business",
  },
  description: "Discover and manage verified creator partnerships. Search by niche, subscribers, and engagement — all metrics verified directly from platform APIs.",
  openGraph: {
    type: "website",
    siteName: "Tether for Business",
    title: "Tether for Business",
    description: "Discover verified creators. Search by niche, subscribers, and engagement.",
    url: BASE_URL,
  },
  twitter: {
    card: "summary",
    title: "Tether for Business",
    description: "Discover verified creators. Search by niche, subscribers, and engagement.",
  },
  icons: {
    icon: "/favicon.svg",
  },
  themeColor: "#7c3aed",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
