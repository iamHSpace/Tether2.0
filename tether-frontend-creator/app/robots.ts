import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/c/"],
        disallow: ["/dashboard", "/settings", "/onboarding", "/api/"],
      },
    ],
    sitemap: "https://tether-frontend.vercel.app/sitemap.xml",
  };
}
