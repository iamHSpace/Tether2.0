"use client";

import { useState } from "react";
import { fmt, timeAgo } from "@/lib/utils";
import { IconEye, IconVideo, IconRefresh, IconExternal } from "@/components/ui/Icons";

interface VideoWithMetrics {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  views: number;
  likes: number;
  comments: number;
  engagementScore: number;
  interactionRate: number;
}

interface VideoListProps {
  videos: VideoWithMetrics[];
  totalCount: number;
}

export function VideoList({ videos, totalCount }: VideoListProps) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? videos : videos.slice(0, 5);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
        <h3 className="text-sm font-bold text-gray-900">Post Activity</h3>
        <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">{totalCount} videos</span>
      </div>
      <div className="divide-y divide-gray-50">
        {visible.map(v => (
          <div key={v.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
            {v.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.thumbnail} alt={v.title ?? "Video"} width={72} height={44}
                className="rounded-xl object-cover shrink-0 border border-gray-100" />
            ) : (
              <div className="w-[72px] h-11 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                <IconVideo size={14} className="text-gray-300" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 line-clamp-1">{v.title || <span className="text-gray-300 italic">Untitled</span>}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(v.publishedAt)}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0 text-xs text-gray-400">
              <span className="flex items-center gap-1"><IconEye size={11} className="text-gray-300" />{fmt(v.views)}</span>
              <span className="hidden sm:flex items-center gap-1"><IconRefresh size={11} className="text-gray-300" />{v.engagementScore}</span>
              <span className="hidden sm:flex items-center gap-1">{v.interactionRate.toFixed(1)}%</span>
              <a href={`https://youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer"
                className="w-6 h-6 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-100">
                <IconExternal size={10} className="text-gray-400" />
              </a>
            </div>
          </div>
        ))}
      </div>
      {videos.length > 5 && (
        <div className="px-5 py-3 border-t border-gray-50">
          <button onClick={() => setShowAll(v => !v)}
            className="text-xs font-medium text-brand-600 hover:text-brand-700">
            {showAll ? "Show less" : `Show all ${videos.length} videos`}
          </button>
        </div>
      )}
    </div>
  );
}
