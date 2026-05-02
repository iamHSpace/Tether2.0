"use client";

import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  IconDashboard, IconBarChart, IconLink,
  IconSettings, IconLogout, IconUser
} from "@/components/ui/Icons";

const NAV = [
  { href: "/dashboard",   label: "Dashboard",   Icon: IconDashboard },
  { href: "/analytics",   label: "Analytics",   Icon: IconBarChart  },
  { href: "/connections", label: "Connections", Icon: IconLink      },
];

const BOTTOM_NAV = [
  { href: "/settings", label: "Settings", Icon: IconSettings },
];

interface Props { email?: string; username?: string; }

export default function Sidebar({ email, username }: Props) {
  const path = usePathname();

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 flex flex-col bg-white border-r border-gray-100">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="font-bold text-gray-900 tracking-tight">Tether</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-3 mb-2">Menu</p>
        {NAV.map(({ href, label, Icon }) => (
          <a key={href} href={href} className={cn("sidebar-link", path === href && "active")}>
            <Icon size={16} /> {label}
          </a>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 space-y-0.5 border-t border-gray-100 pt-3">
        {BOTTOM_NAV.map(({ href, label, Icon }) => (
          <a key={href} href={href} className={cn("sidebar-link", path === href && "active")}>
            <Icon size={16} /> {label}
          </a>
        ))}
        <button onClick={handleLogout} className="sidebar-link w-full text-red-500 hover:bg-red-50 hover:text-red-600">
          <IconLogout size={16} /> Sign out
        </button>

        {/* User pill */}
        <div className="mt-3 flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gray-50">
          <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
            <IconUser size={14} className="text-brand-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">{username ?? "Creator"}</p>
            <p className="text-[10px] text-gray-400 truncate">{email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
