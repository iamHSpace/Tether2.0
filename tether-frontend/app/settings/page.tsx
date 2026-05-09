"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import Sidebar from "@/components/layout/Sidebar";
import { IconSave, IconUser, IconLink, IconBell, IconShield, IconTrash, IconAlert, IconCheck, IconCode, IconKey, IconCopy } from "@/components/ui/Icons";
import type { ApiKey, UserSubscription, SubscriptionPlan } from "@/lib/api";

const CREATOR_CATEGORIES = [
  "Gaming", "Tech & Science", "Education", "Lifestyle", "Vlog",
  "Beauty & Fashion", "Food & Cooking", "Travel", "Fitness & Health",
  "Business & Finance", "Comedy & Entertainment", "Music",
  "Art & Design", "Sports", "Kids & Family", "DIY & How-to",
  "News & Politics", "Other",
] as const;

interface SettingsProfile {
  username: string;
  full_name: string;
  company_name: string;
  bio: string;
  website: string;
  avatar_url: string;
  email: string;
  category: string;
}

type Tab = "profile" | "connections" | "notifications" | "account" | "developer" | "subscription";

function IconCreditCard({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
      <line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  );
}

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "profile",       label: "Profile",       icon: IconUser        },
  { id: "connections",   label: "Connections",   icon: IconLink        },
  { id: "notifications", label: "Notifications", icon: IconBell        },
  { id: "account",       label: "Account",       icon: IconShield      },
  { id: "subscription",  label: "Subscription",  icon: IconCreditCard  },
  { id: "developer",     label: "Developer",     icon: IconCode        },
];

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

export default function SettingsPage() {
  const [tab, setTab]         = useState<Tab>("profile");
  const [profile, setProfile] = useState<SettingsProfile>({ username: "", full_name: "", company_name: "", bio: "", website: "", avatar_url: "", email: "", category: "" });
  const [savedUsername, setSavedUsername] = useState("");   // username already in DB
  const [userType, setUserType] = useState<"creator" | "business">("creator");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [usernameHint, setUsernameHint]     = useState<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscription tab state
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [effectivePlan, setEffectivePlan] = useState<SubscriptionPlan | null>(null);
  const [subLoading, setSubLoading]     = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading]     = useState(false);

  // Developer tab state
  const [apiKeys, setApiKeys]           = useState<ApiKey[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [newKeyName, setNewKeyName]     = useState("");
  const [newKeyExpiry, setNewKeyExpiry] = useState("");
  const [creatingKey, setCreatingKey]   = useState(false);
  const [newRawKey, setNewRawKey]       = useState<string | null>(null);
  const [copiedKey, setCopiedKey]       = useState(false);
  const [revokingId, setRevokingId]     = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }

      try {
        const { profile: prof, email } = await api.profile.get();
        const u = prof.username ?? "";
        setProfile({
          username:     u,
          full_name:    prof.full_name    ?? "",
          company_name: prof.company_name ?? "",
          bio:          prof.bio          ?? "",
          website:      prof.website      ?? "",
          avatar_url:   prof.avatar_url   ?? "",
          email:        email ?? user.email ?? "",
          category:     prof.category     ?? "",
        });
        setSavedUsername(u);
        if (u) setUsernameStatus("available");
        if (prof.user_type === "business") setUserType("business");
      } catch {
        setProfile(p => ({ ...p, email: user.email ?? "" }));
      }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (tab !== "subscription") return;
    setSubLoading(true);
    api.subscriptions.current()
      .then(r => { setSubscription(r.subscription); setEffectivePlan(r.effective_plan); })
      .catch(() => {})
      .finally(() => setSubLoading(false));
  }, [tab]);

  useEffect(() => {
    if (tab !== "developer") return;
    setApiKeysLoading(true);
    api.developer.keys()
      .then(r => setApiKeys(r.keys))
      .catch(() => {})
      .finally(() => setApiKeysLoading(false));
  }, [tab]);

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    setNewRawKey(null);
    try {
      const { key } = await api.developer.createKey(newKeyName.trim(), newKeyExpiry || undefined);
      setNewRawKey(key.raw_key);
      setNewKeyName(""); setNewKeyExpiry("");
      setApiKeys(prev => [key, ...prev]);
    } catch { /* non-fatal */ } finally { setCreatingKey(false); }
  }

  async function handleRevokeKey(id: string) {
    setRevokingId(id);
    try {
      await api.developer.revokeKey(id);
      setApiKeys(prev => prev.filter(k => k.id !== id));
    } catch { /* non-fatal */ } finally { setRevokingId(null); }
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key).then(() => {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    });
  }

  function handleUsernameChange(raw: string) {
    const val = raw.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    setProfile(p => ({ ...p, username: val }));

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!val) { setUsernameStatus("idle"); setUsernameHint(""); return; }

    if (val === savedUsername) {
      setUsernameStatus("available"); setUsernameHint(""); return;
    }

    if (val.length < 3) {
      setUsernameStatus("invalid"); setUsernameHint("At least 3 characters required"); return;
    }

    setUsernameStatus("checking"); setUsernameHint("");

    debounceRef.current = setTimeout(async () => {
      try {
        const { available, error: hint } = await api.profile.checkUsername(val);
        if (hint) { setUsernameStatus("invalid"); setUsernameHint(hint); }
        else { setUsernameStatus(available ? "available" : "taken"); setUsernameHint(available ? "" : "This username is already taken"); }
      } catch {
        setUsernameStatus("idle"); setUsernameHint("");
      }
    }, 450);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (usernameStatus === "taken" || usernameStatus === "invalid") return;
    setSaving(true); setError(null);
    try {
      await api.profile.update({
        username:     profile.username.trim()     || null,
        full_name:    profile.full_name.trim()    || null,
        company_name: profile.company_name.trim() || null,
        bio:          profile.bio.trim()          || null,
        website:      profile.website.trim()      || null,
        category:     profile.category            || null,
      });
      setSavedUsername(profile.username.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Surface duplicate-username DB errors in plain language
      setError(msg.includes("unique") || msg.includes("duplicate")
        ? "That username is already taken. Please choose another."
        : msg);
    }
    setSaving(false);
  }

  function set(key: keyof SettingsProfile, val: string) {
    setProfile(p => ({ ...p, [key]: val }));
  }

  const canSave = usernameStatus !== "taken" && usernameStatus !== "invalid" && usernameStatus !== "checking";

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
      <Sidebar
        email={profile.email}
        username={profile.username || undefined}
        displayName={userType === "business" ? (profile.company_name || profile.full_name || profile.username || undefined) : (profile.full_name || profile.username || undefined)}
        userType={userType}
      />

      <main className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-gray-100 px-8 py-4 sticky top-0 z-10">
          <h1 className="text-xl font-bold text-gray-900">Settings</h1>
          <p className="text-xs text-gray-400 mt-0.5">Manage your profile and account preferences</p>
        </header>

        <div className="p-8 max-w-3xl">
          {/* Tab nav — hide Connections for business, Developer for creators */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6 w-fit">
            {TABS.filter(t =>
              !(userType === "business" && t.id === "connections") &&
              !(userType === "creator"  && t.id === "developer")  &&
              !(userType === "creator"  && t.id === "subscription")
            ).map(({ id, label, icon: Icon }) => (
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
                <h2 className="font-semibold text-gray-900 mb-1">
                  {userType === "business" ? "Company profile" : "Public profile"}
                </h2>
                <p className="text-sm text-gray-500">
                  {userType === "business"
                    ? "This is what creators see when they view your company."
                    : "This is what brands and agencies see when you share your link."}
                </p>
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
                  {userType === "business"
                    ? (profile.company_name?.[0] ?? profile.full_name?.[0] ?? profile.username?.[0]?.toUpperCase() ?? "?")
                    : (profile.full_name?.[0] ?? profile.username?.[0]?.toUpperCase() ?? "?")}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Profile picture</p>
                  <p className="text-xs text-gray-400 mt-0.5">Avatar upload coming soon. Your initial is used for now.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {userType === "business" ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Company name</label>
                    <input className="input" placeholder="Acme Corp"
                      value={profile.company_name} onChange={e => set("company_name", e.target.value)} />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name</label>
                    <input className="input" placeholder="Jane Creator"
                      value={profile.full_name} onChange={e => set("full_name", e.target.value)} />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">@</span>
                    <input
                      className={`input pl-7 pr-8 ${
                        usernameStatus === "taken" || usernameStatus === "invalid"
                          ? "border-red-300 focus:ring-red-200"
                          : usernameStatus === "available" ? "border-green-300 focus:ring-green-200" : ""
                      }`}
                      placeholder="yourcreatorname"
                      value={profile.username}
                      onChange={e => handleUsernameChange(e.target.value)}
                      maxLength={30}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    {/* Status indicator */}
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                      {usernameStatus === "checking" && (
                        <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-brand-500 rounded-full animate-spin inline-block" />
                      )}
                      {usernameStatus === "available" && profile.username && (
                        <IconCheck size={14} className="text-green-500" />
                      )}
                      {(usernameStatus === "taken" || usernameStatus === "invalid") && (
                        <span className="text-red-400 font-bold leading-none">✕</span>
                      )}
                    </span>
                  </div>
                  {/* Hint row */}
                  {usernameHint ? (
                    <p className="text-xs text-red-500 mt-1">{usernameHint}</p>
                  ) : profile.username && usernameStatus === "available" ? (
                    <p className="text-xs text-green-600 mt-1">
                      statvora.io/c/<strong>{profile.username}</strong>
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 mt-1">
                      3–30 chars · letters, numbers, _ and -
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {userType === "business" ? "About your company" : "Bio"}
                </label>
                <textarea
                  className="input resize-none" rows={3}
                  placeholder={userType === "business" ? "Tell creators what your company does…" : "Tell brands and agencies about yourself…"}
                  value={profile.bio}
                  onChange={e => set("bio", e.target.value)}
                  maxLength={200}
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{profile.bio.length}/200</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {userType === "business" ? "Industry" : "Channel category"}
                </label>
                <select
                  className="input"
                  value={profile.category}
                  onChange={e => set("category", e.target.value)}
                >
                  <option value="">— Select —</option>
                  {CREATOR_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  {userType === "business" ? "Helps creators find businesses in the right space." : "Helps brands find creators in the right niche."}
                </p>
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
                <button type="submit" disabled={saving || !canSave}
                  className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
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
              <p className="text-sm text-gray-500 mb-5">Manage the social accounts linked to your Statvora profile.</p>

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
                    Re-authorise
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
              <p className="text-sm text-gray-500 mb-5">Choose when and how you hear from Statvora.</p>
              <div className="space-y-4">
                {[
                  { label: "Brand enquiries", desc: "When a brand views your profile", default: true },
                  { label: "Metric milestones", desc: "When you hit a subscriber milestone", default: true },
                  { label: "Weekly digest", desc: "A weekly summary of your stats", default: false },
                  { label: "Product updates", desc: "New Statvora features and announcements", default: false },
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

          {/* Subscription tab */}
          {tab === "subscription" && (
            <div className="space-y-5">
              <div className="card p-6">
                <h2 className="font-semibold text-gray-900 mb-1">Your Subscription</h2>
                <p className="text-sm text-gray-500 mb-4">Manage your plan and billing.</p>

                {subLoading ? (
                  <div className="text-sm text-gray-400">Loading…</div>
                ) : (
                  <>
                    {/* Current plan card */}
                    <div className="rounded-xl border border-gray-200 p-4 mb-4">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-lg font-bold text-gray-900">{effectivePlan?.name ?? "Starter"}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          subscription?.status === "active" ? "bg-green-100 text-green-700" :
                          subscription?.status === "past_due" ? "bg-red-100 text-red-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {subscription?.status ?? "Free"}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mb-1">
                        {effectivePlan?.is_free
                          ? "You are on the free Starter plan."
                          : effectivePlan?.is_enterprise
                            ? "Enterprise plan — contact your account manager."
                            : `$${((effectivePlan?.price_cents ?? 0) / 100).toFixed(0)} / ${effectivePlan?.billing_period}`}
                      </div>
                      {subscription?.current_period_end && (
                        <div className="text-xs text-gray-400">
                          {subscription.cancel_at_period_end
                            ? `Cancels on ${new Date(subscription.current_period_end).toLocaleDateString()}`
                            : `Renews on ${new Date(subscription.current_period_end).toLocaleDateString()}`}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 flex-wrap">
                      <a
                        href="/pricing"
                        className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-semibold hover:bg-brand-700 transition-colors"
                      >
                        {effectivePlan?.is_free ? "Upgrade Plan" : "Change Plan"}
                      </a>
                      {subscription && !subscription.plan?.is_free && (
                        <button
                          disabled={portalLoading}
                          onClick={async () => {
                            setPortalLoading(true);
                            try {
                              const r = await api.subscriptions.portal();
                              if (r.url) window.location.href = r.url;
                            } catch { /* non-fatal */ } finally { setPortalLoading(false); }
                          }}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                          {portalLoading ? "Loading…" : "Manage Billing"}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="card p-6">
                <h3 className="font-semibold text-gray-900 mb-1">Need more?</h3>
                <p className="text-sm text-gray-500 mb-3">Compare all plans on our pricing page or contact us for an Enterprise quote.</p>
                <div className="flex gap-3">
                  <a href="/pricing" className="text-sm font-medium text-brand-600 hover:underline">View pricing →</a>
                </div>
              </div>
            </div>
          )}

          {/* Developer tab */}
          {tab === "developer" && (
            <div className="space-y-5">
              {/* Intro */}
              <div className="card p-6">
                <div className="flex items-start gap-3">
                  <IconKey size={18} className="text-brand-600 shrink-0 mt-0.5" />
                  <div>
                    <h2 className="font-semibold text-gray-900 mb-1">API Keys</h2>
                    <p className="text-sm text-gray-500">
                      Use API keys to authenticate requests to the{" "}
                      <a href="/api/docs" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline font-medium">
                        Statvora v1 API
                      </a>
                      . Keys are shown once — copy them immediately.
                    </p>
                  </div>
                </div>
              </div>

              {/* New key after creation */}
              {newRawKey && (
                <div className="card p-5 border-green-200 bg-green-50">
                  <p className="text-sm font-semibold text-green-800 mb-2">API key created — copy it now</p>
                  <p className="text-xs text-green-700 mb-3">This is the only time you&apos;ll see this key. Store it somewhere safe.</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-white border border-green-200 rounded-lg px-3 py-2 text-xs font-mono text-green-900 overflow-x-auto select-all">
                      {newRawKey}
                    </code>
                    <button
                      onClick={() => copyKey(newRawKey)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-all shrink-0"
                    >
                      {copiedKey ? <IconCheck size={13} /> : <IconCopy size={13} />}
                      {copiedKey ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <button onClick={() => setNewRawKey(null)} className="mt-3 text-xs text-green-700 hover:underline">
                    I&apos;ve saved it — dismiss
                  </button>
                </div>
              )}

              {/* Create key form */}
              <div className="card p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Create a new key</h3>
                <form onSubmit={handleCreateKey} className="flex flex-col sm:flex-row gap-3">
                  <input
                    value={newKeyName}
                    onChange={e => setNewKeyName(e.target.value)}
                    placeholder="Key name (e.g. My Dashboard)"
                    maxLength={100}
                    required
                    className="input py-2 text-sm flex-1"
                  />
                  <input
                    type="date"
                    value={newKeyExpiry}
                    onChange={e => setNewKeyExpiry(e.target.value)}
                    className="input py-2 text-sm w-40"
                    title="Expiry date (optional)"
                    min={new Date().toISOString().split("T")[0]}
                  />
                  <button
                    type="submit"
                    disabled={creatingKey || !newKeyName.trim()}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-all shrink-0"
                  >
                    {creatingKey ? "Creating…" : "Create key"}
                  </button>
                </form>
                <p className="text-xs text-gray-400 mt-2">Leave expiry blank for a non-expiring key. Max 10 active keys.</p>
              </div>

              {/* Existing keys */}
              <div className="card overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-900">Your keys</h3>
                </div>
                {apiKeysLoading ? (
                  <div className="p-6 space-y-3">
                    {Array(2).fill(0).map((_, i) => (
                      <div key={i} className="animate-pulse bg-gray-100 rounded-xl h-14" />
                    ))}
                  </div>
                ) : apiKeys.length === 0 ? (
                  <div className="p-8 text-center">
                    <IconKey size={28} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No API keys yet. Create one above.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {apiKeys.map(k => (
                      <div key={k.id} className="flex items-center gap-4 px-6 py-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 truncate">{k.name}</p>
                            {!k.is_active && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold">Revoked</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <code className="text-xs font-mono text-gray-400">{k.key_prefix}…</code>
                            <span className="text-xs text-gray-400">
                              Created {new Date(k.created_at).toLocaleDateString()}
                            </span>
                            {k.last_used_at && (
                              <span className="text-xs text-gray-400">
                                Last used {new Date(k.last_used_at).toLocaleDateString()}
                              </span>
                            )}
                            {k.expires_at && (
                              <span className={`text-xs ${new Date(k.expires_at) < new Date() ? "text-red-500" : "text-gray-400"}`}>
                                Expires {new Date(k.expires_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        {k.is_active && (
                          <button
                            disabled={revokingId === k.id}
                            onClick={() => handleRevokeKey(k.id)}
                            className="text-xs font-medium px-2.5 py-1.5 rounded-lg text-red-600 border border-red-200 hover:bg-red-50 transition-all disabled:opacity-40 shrink-0"
                          >
                            {revokingId === k.id ? "Revoking…" : "Revoke"}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Usage example */}
              <div className="card p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Usage example</h3>
                <pre className="bg-gray-950 text-gray-100 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed">
{`# Search creators
curl https://statvora-backend.vercel.app/api/v1/creators?q=tech \\
  -H "Authorization: Bearer stv_your_key_here"

# Get your own profile & metrics
curl https://statvora-backend.vercel.app/api/v1/me \\
  -H "Authorization: Bearer stv_your_key_here"`}
                </pre>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
