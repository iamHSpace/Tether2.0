import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tether for Business",
  description: "Discover and manage verified creator partnerships",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
