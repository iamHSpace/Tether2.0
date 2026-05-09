import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create your free Statvora profile. Share verified YouTube and Instagram metrics with brands and agencies.",
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
