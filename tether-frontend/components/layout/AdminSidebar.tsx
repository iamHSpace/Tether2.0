"use client";

import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  IconUsers, IconDashboard, IconSettings, IconLogout,
} from "@/components/ui/Icons";

// Inline icons for admin-specific nav items
function IconShieldCheck({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  );
}

function IconBarChart({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  );
}

function IconFlag({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
    </svg>
  );
}

function IconActivity({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  );
}

function IconCreditCard({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
      <line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  );
}

const ADMIN_NAV = [
  { href: "/admin/users",         label: "Users",           Icon: IconUsers      },
  { href: "/admin/health",        label: "Platform Health", Icon: IconActivity   },
  { href: "/admin/analytics",     label: "Analytics",       Icon: IconBarChart   },
  { href: "/admin/moderation",    label: "Moderation",      Icon: IconFlag       },
  { href: "/admin/subscriptions", label: "Subscriptions",   Icon: IconCreditCard },
];

interface Props {
  email?: string;
  displayName?: string;
}

export default function AdminSidebar({ email, displayName }: Props) {
  const path = usePathname();

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 flex flex-col bg-gray-900 border-r border-gray-800 text-gray-200">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-800">
        <a href="/admin/users" className="flex items-center gap-2.5">
          <img src="/brand/logo-icon-dark.svg" width={32} height={32} alt="Statvora" className="rounded-xl" />
          <span className="font-bold text-white tracking-tight">Statvora</span>
          <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-900 text-red-300 border border-red-800 uppercase tracking-wide">Admin</span>
        </a>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest px-3 mb-2">Admin Panel</p>
        {ADMIN_NAV.map(({ href, label, Icon }) => {
          const active = path.startsWith(href);
          return (
            <a key={href} href={href} className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
              active
                ? "bg-brand-600 text-white"
                : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
            )}>
              <Icon size={15} /> {label}
            </a>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 space-y-0.5 border-t border-gray-800 pt-3">
        <a href="/dashboard" className={cn("flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-gray-100 transition-all")}>
          <IconDashboard size={15} /> Back to App
        </a>
        <a href="/admin/settings" className={cn("flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
          path === "/admin/settings" ? "bg-brand-600 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-gray-100")}>
          <IconSettings size={15} /> Settings
        </a>
        <button onClick={handleLogout} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium w-full text-red-400 hover:bg-red-950 hover:text-red-300 transition-all">
          <IconLogout size={15} /> Sign out
        </button>

        {/* User pill */}
        <div className="mt-3 flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gray-800">
          <div className="w-7 h-7 rounded-full bg-brand-700 flex items-center justify-center shrink-0">
            <IconShieldCheck size={12} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-100 truncate">{displayName ?? "Admin"}</p>
            <p className="text-[10px] text-gray-500 truncate">{email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
