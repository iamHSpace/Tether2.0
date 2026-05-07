"use client";

import { supabase } from "@/lib/supabase";

export default function SuspendedPage() {
  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-red-50 flex items-center justify-center p-4">
      <div className="card p-10 max-w-sm w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Account suspended</h2>
        <p className="text-gray-500 text-sm leading-relaxed mb-6">
          Your account has been suspended. If you believe this is a mistake, please contact support.
        </p>
        <button
          onClick={handleLogout}
          className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 transition-all"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
