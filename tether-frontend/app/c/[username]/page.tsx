import { permanentRedirect } from "next/navigation";

/**
 * Legacy route — redirects permanently (308) to the canonical @ URL.
 *
 * /c/mkbhd  →  /@mkbhd
 *
 * This preserves all existing inbound links and bookmarks while moving the
 * canonical URL to the shorter /@username format.
 */
export default async function LegacyCreatorRoute(
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  permanentRedirect(`/@${username}`);
}
