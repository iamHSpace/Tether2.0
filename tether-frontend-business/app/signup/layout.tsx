import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Sign up for Tether for Business and discover verified creators.",
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
