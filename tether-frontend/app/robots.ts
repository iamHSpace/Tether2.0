import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/@", "/b/@", "/c/"],
        disallow: ["/dashboard", "/settings", "/onboarding", "/api/"],
      },
    ],
    sitemap: "https://statvora.in/sitemap.xml",
  };
}
