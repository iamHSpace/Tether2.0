"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";

function generateUsername(firstName: string): string {
  const base   = firstName.toLowerCase().replace(/[^a-z0-9]/g, "") || "user";
  const chars  = "abcdefghijklmnopqrstuvwxyz0123456789";
  const suffix = Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
  return base + suffix;
}

export default function GoogleAuthComplete() {
  useEffect(() => {
    async function finalize() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login?error=session_failed";
        return;
      }

      let userType = user.user_metadata?.user_type as string | undefined;
      let isNew    = false;

      if (!userType) {
        isNew    = true;
        userType = (localStorage.getItem("_pending_user_type") as "creator" | "business" | null) ?? "creator";
      }

      if (isNew) {
        // Google populates full_name (and given_name) from the ID token via Supabase
        const fullName =
          (user.user_metadata?.full_name as string | undefined) ||
          (user.user_metadata?.name      as string | undefined) ||
          (localStorage.getItem("_pending_full_name"))           ||
          "";

        const givenName = (user.user_metadata?.given_name as string | undefined) || fullName.split(" ")[0] || "";
        const username  = generateUsername(givenName || fullName);
        const company   = localStorage.getItem("_pending_company") ?? undefined;

        // Embed role + name in auth JWT metadata
        const metadata: Record<string, string> = { user_type: userType };
        if (fullName)                                   metadata.full_name    = fullName;
        if (userType === "business" && company?.trim()) metadata.company_name = company.trim();
        await supabase.auth.updateUser({ data: metadata });

        // Create profile row so name + username are persisted from day one
        try {
          await api.profile.update({
            full_name:    fullName || null,
            username,
            user_type:    userType as "creator" | "business",
            company_name: userType === "business" && company?.trim() ? company.trim() : undefined,
          });
        } catch { /* non-fatal */ }

        localStorage.removeItem("_pending_user_type");
        localStorage.removeItem("_pending_full_name");
        localStorage.removeItem("_pending_company");
      }

      if (userType === "business") {
        window.location.href = "/discover";
      } else {
        window.location.href = isNew ? "/onboarding" : "/dashboard";
      }
    }

    finalize();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-purple-50 flex items-center justify-center">
      <div className="text-center">
        <img src="/brand/logo-icon.svg" width={48} height={48} alt="Statvora" className="rounded-2xl mb-4 mx-auto" />
        <p className="text-gray-500 text-sm">Completing sign in…</p>
      </div>
    </div>
  );
}
