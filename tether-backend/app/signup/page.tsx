import { redirect } from "next/navigation";

/** Backend has no signup UI — redirect to the frontend. */
export default function SignupPage() {
  const frontendUrl = process.env.FRONTEND_URL ?? "http://127.0.0.1:3001";
  redirect(`${frontendUrl}/signup`);
}
