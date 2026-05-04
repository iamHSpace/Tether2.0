"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import Sidebar from "@/components/layout/Sidebar";

export default function SettingsPage() {
  const [email, setEmail]     = useState("");
  const [name, setName]       = useState("");
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      try {
        const { profile, email: em } = await api.profile.get();
        setEmail(em ?? user.email ?? "");
        setName(profile.full_name ?? "");
      } catch { setEmail(user.email ?? ""); }
      setLoading(false);
    })();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await api.profile.update({ full_name: name.trim() || null });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
    setSaving(false);
  }

  return (
    <div className="flex h-screen bg-[#f5f0e8] overflow-hidden">
      <Sidebar email={email} name={name} />
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white/70 backdrop-blur-sm border-b border-white/80 px-8 py-4 sticky top-0 z-10">
          <h1 className="text-base font-bold text-gray-900">Settings</h1>
          <p className="text-xs text-gray-400 mt-0.5">Manage your business account</p>
        </header>
        <div className="p-8 max-w-lg">
          {loading ? (
            <div className="bg-white rounded-2xl p-6 border border-gray-100 animate-pulse h-40" />
          ) : (
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-card">
              <h2 className="text-sm font-bold text-gray-900 mb-5">Account details</h2>
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Company / Name</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Your company or name" className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input value={email} disabled className="input opacity-50 cursor-not-allowed" />
                </div>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
                </button>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
