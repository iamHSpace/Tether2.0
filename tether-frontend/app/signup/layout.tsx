import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create your free Tether creator profile and share verified metrics with brands.",
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
