import { redirect } from "next/navigation";

/** Backend has no login UI — redirect to the frontend. */
export default function LoginPage() {
  const frontendUrl = process.env.FRONTEND_URL ?? "http://127.0.0.1:3001";
  redirect(`${frontendUrl}/login`);
}
