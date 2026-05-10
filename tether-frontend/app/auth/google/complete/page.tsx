"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

/**
 * /auth/google/complete
 *
 * Landing page after the GIS redirect callback has exchanged the credential
 * for a Supabase session.  This client component:
 *   1. Reads the now-active session to get the user
 *   2. If new (no user_type), applies the pending role stored in localStorage
 *   3. Redirects to the appropriate page
 */
export default function GoogleAuthComplete() {
  useEffect(() => {
    async function finalize() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login?error=session_failed";
        return;
      }

      let userType = user.user_metadata?.user_type as string | undefined;
      let isNew    = false;

      if (!userType) {
        // New user — apply the intent stored before the Google redirect
        isNew = true;
        const pendingType    = localStorage.getItem("_pending_user_type") as
          | "creator"
          | "business"
          | null;
        const pendingCompany = localStorage.getItem("_pending_company");

        userType = pendingType ?? "creator";
        const metadata: Record<string, string> = { user_type: userType };
        if (userType === "business" && pendingCompany?.trim()) {
          metadata.company_name = pendingCompany.trim();
        }

        await supabase.auth.updateUser({ data: metadata });

        localStorage.removeItem("_pending_user_type");
        localStorage.removeItem("_pending_company");
      }

      // Route to the right place
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
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-600 mb-4">
          <img src="/brand/logo-icon.svg" width={24} height={24} alt="Statvora" />
        </div>
        <p className="text-gray-500 text-sm">Completing sign in…</p>
      </div>
    </div>
  );
}
