"use client";

import { useState } from "react";
import { IconYoutube, IconInstagram } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";

type PlatformId = "youtube" | "instagram";

interface TabDef {
  id: PlatformId;
  subtitle?: string;
}

interface PlatformTabsProps {
  tabs: TabDef[];
  youtube?: React.ReactNode;
  instagram?: React.ReactNode;
}

export function PlatformTabs({ tabs, youtube, instagram }: PlatformTabsProps) {
  const [active, setActive] = useState<PlatformId>(tabs[0]?.id ?? "youtube");

  const content: Record<PlatformId, React.ReactNode | undefined> = { youtube, instagram };

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-white rounded-2xl border border-gray-100 shadow-card w-fit">
        {tabs.map(tab => {
          const isActive = active === tab.id;
          const Icon = tab.id === "youtube" ? IconYoutube : IconInstagram;
          const label = tab.id === "youtube" ? "YouTube" : "Instagram";
          return (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                isActive && tab.id === "youtube"    && "bg-red-50 text-red-600",
                isActive && tab.id === "instagram"  && "bg-pink-50 text-pink-600",
                !isActive && "text-gray-300 hover:text-gray-500",
              )}
            >
              <Icon size={15} />
              <span>{label}</span>
              {tab.subtitle && (
                <span className="text-[10px] font-normal opacity-70">{tab.subtitle}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active tab content */}
      {content[active]}
    </div>
  );
}
