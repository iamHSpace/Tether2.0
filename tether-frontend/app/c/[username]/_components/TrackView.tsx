"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:3000";

/**
 * Invisible client island — fires a fire-and-forget tracking call to the backend
 * on first mount so the server component (/c/[username]) can remain a pure RSC.
 */
export function TrackView({ username }: { username: string }) {
  useEffect(() => {
    let alive = true;

    async function track() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!alive) return;

      fetch(`${BACKEND}/api/track/view`, {
        method:    "POST",
        headers:   {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body:      JSON.stringify({ username }),
        keepalive: true, // survives page navigations / tab closes
      }).catch(() => {});
    }

    track();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
