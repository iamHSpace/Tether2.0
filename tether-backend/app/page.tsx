import { redirect } from "next/navigation";

/**
 * The backend is a pure API server — there is no UI here.
 * Redirect any browser visit to the frontend application.
 */
export default function Home() {
  const frontendUrl = process.env.FRONTEND_URL ?? "http://127.0.0.1:3001";
  redirect(frontendUrl);
}
