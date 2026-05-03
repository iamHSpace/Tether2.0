"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import Sidebar from "@/components/layout/Sidebar";
import { IconSave, IconUser, IconLink, IconBell, IconShield, IconTrash, IconAlert } from "@/components/ui/Icons";

interface SettingsProfile {
  username: string;
  full_name: string;
  bio: string;
  website: string;
  avatar_url: string;
  email: string;
}

type Tab = "profile" | "connections" | "notifications" | "account";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "profile",       label: "Profile",       icon: IconUser    },
  { id: "connections",   label: "Connections",   icon: IconLink   },
  { id: "notifications", label: "Notifications", icon: IconBell    },
  { id: "account",       label: "Account",       icon: IconShield  },
];

export default function SettingsPage() {
  const [tab, setTab]         = useState<Tab>("profile");
  const [profile, setProfile] = useState<SettingsProfile>({ username: "", full_name: "", bio: "", website: "", avatar_url: "", email: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      // Guard: ensure session exists
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }

      try {
        // Load profile via backend API — no direct DB call
        const { profile: prof, email } = await api.profile.get();
        setProfile({
          username:   prof.username   ?? "",
          full_name:  prof.full_name  ?? "",
          bio:        prof.bio        ?? "",
          website:    prof.website    ?? "",
          avatar_url: prof.avatar_url ?? "",
          email:      email ?? user.email ?? "",
        });
      } catch {
        setProfile(p => ({ ...p, email: user.email ?? "" }));
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      // Save via backend API — no direct DB call
      await api.profile.update({
        username:  profile.username.trim() || null,
        full_name: profile.full_name.trim() || null,
        bio:       profile.bio.trim() || null,
        website:   profile.website.trim() || null,
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setSaving(false);
  }

  function set(key: keyof SettingsProfile, val: string) {
    setProfile(p => ({ ...p, [key]: val }));
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar email={profile.email} username={profile.username || undefined} />

      <main className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-gray-100 px-8 py-4 sticky top-0 z-10">
          <h1 className="text-xl font-bold text-gray-900">Settings</h1>
          <p className="text-xs text-gray-400 mt-0.5">Manage your profile and account preferences</p>
        </header>

        <div className="p-8 max-w-3xl">
          {/* Tab nav */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6 w-fit">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          {/* Profile tab */}
          {tab === "profile" && (
            <form onSubmit={handleSave} className="card p-6 space-y-5">
              <div>
                <h2 className="font-semibold text-gray-900 mb-1">Public profile</h2>
                <p className="text-sm text-gray-500">This is what brands and agencies see when you share your link.</p>
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">{error}</div>
              )}
              {saved && (
                <div className="p-3.5 rounded-xl bg-green-50 border border-green-100 text-green-600 text-sm">✓ Profile saved!</div>
              )}

              {/* Avatar placeholder */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-400 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shrink-0">
                  {profile.full_name?.[0] ?? profile.username?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Profile picture</p>
                  <p className="text-xs text-gray-400 mt-0.5">Avatar upload coming soon. Your initial is used for now.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name</label>
                  <input className="input" placeholder="Jane Creator"
                    value={profile.full_name} onChange={e => set("full_name", e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Username <span className="text-gray-400 font-normal text-xs">· tether.app/@you</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
                    <input className="input pl-7"
                      placeholder="yourcreatorname"
                      value={profile.username}
                      onChange={e => set("username", e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Bio</label>
                <textarea
                  className="input resize-none" rows={3}
                  placeholder="Tell brands and agencies about yourself…"
                  value={profile.bio}
                  onChange={e => set("bio", e.target.value)}
                  maxLength={200}
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{profile.bio.length}/200</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Website</label>
                <input className="input" type="url" placeholder="https://yoursite.com"
                  value={profile.website} onChange={e => set("website", e.target.value)} />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-700">Account email</p>
                  <p className="text-sm text-gray-400">{profile.email}</p>
                </div>
                <button type="submit" disabled={saving}
                  className="btn-primary text-sm flex items-center gap-2">
                  <IconSave size={14} />
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          )}

          {/* Connections tab */}
          {tab === "connections" && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-1">Connected platforms</h2>
              <p className="text-sm text-gray-500 mb-5">Manage the social accounts linked to your Tether profile.</p>

              <div className="space-y-3">
                {/* YouTube */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">YouTube</p>
                      <p className="text-xs text-gray-400">youtube.readonly scope</p>
                    </div>
                  </div>
                  <button
                    onClick={() => api.youtube.connect()}
                    className="btn-secondary text-xs py-1.5 px-3">
                    Reconnect
                  </button>
                </div>

                {/* Instagram — coming soon */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-dashed border-gray-200 opacity-60">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Instagram</p>
                      <p className="text-xs text-gray-400">Coming soon</p>
                    </div>
                  </div>
                  <span className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-400 font-medium">Soon</span>
                </div>
              </div>
            </div>
          )}

          {/* Notifications tab */}
          {tab === "notifications" && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-1">Notifications</h2>
              <p className="text-sm text-gray-500 mb-5">Choose when and how you hear from Tether.</p>
              <div className="space-y-4">
                {[
                  { label: "Brand enquiries", desc: "When a brand views your profile", default: true },
                  { label: "Metric milestones", desc: "When you hit a subscriber milestone", default: true },
                  { label: "Weekly digest", desc: "A weekly summary of your stats", default: false },
                  { label: "Product updates", desc: "New Tether features and announcements", default: false },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{item.label}</p>
                      <p className="text-xs text-gray-500">{item.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked={item.default} />
                      <div className="w-10 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-brand-300 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
                    </label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-4">Notification preferences are saved automatically.</p>
            </div>
          )}

          {/* Account tab */}
          {tab === "account" && (
            <div className="space-y-4">
              <div className="card p-6">
                <h2 className="font-semibold text-gray-900 mb-1">Account security</h2>
                <p className="text-sm text-gray-500 mb-4">Manage your login and security settings.</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Email address</p>
                      <p className="text-xs text-gray-400">{profile.email}</p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium">Verified</span>
                  </div>
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Password</p>
                      <p className="text-xs text-gray-400">Last changed: unknown</p>
                    </div>
                    <button className="btn-secondary text-xs py-1.5 px-3">Change</button>
                  </div>
                </div>
              </div>

              <div className="card p-6 border-red-100">
                <div className="flex items-start gap-3">
                  <IconAlert size={18} className="text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h2 className="font-semibold text-red-700 mb-1">Danger zone</h2>
                    <p className="text-sm text-gray-500 mb-4">
                      These actions are permanent and cannot be undone.
                    </p>
                    <button
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-all"
                      onClick={() => alert("Please contact support to delete your account.")}
                    >
                      <IconTrash size={14} /> Delete my account
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
