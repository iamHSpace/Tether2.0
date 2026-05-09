import type { MetadataRoute } from "next";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:3000";
const BASE_URL = "https://statvora.vercel.app";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "monthly", priority: 1 },
    { url: `${BASE_URL}/login`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/signup`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.5 },
  ];

  try {
    const res = await fetch(`${BACKEND}/api/creators/list`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const { usernames } = await res.json() as { usernames: string[] };
      for (const username of usernames) {
        entries.push({
          url: `${BASE_URL}/@${encodeURIComponent(username)}`,
          lastModified: new Date(),
          changeFrequency: "weekly",
          priority: 0.8,
        });
      }
    }
  } catch {
    // Backend unavailable at build time — sitemap will only contain static pages
  }

  return entries;
}
