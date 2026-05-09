/**
 * Legacy OG image route — redirects to the canonical /@username OG image.
 * This ensures any cached og:image URLs from /c/[username] still resolve.
 */
import { redirect } from "next/navigation";

export default async function LegacyOgImage(
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  redirect(`/@${username}/opengraph-image`);
}
