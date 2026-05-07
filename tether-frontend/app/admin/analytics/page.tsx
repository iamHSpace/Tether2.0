"use client";

import { useEffect, useState } from "react";
import { api, AdminAnalytics } from "@/lib/api";

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <p className="text-2xl font-bold text-gray-900">{typeof value === "number" ? value.toLocaleString() : value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      <p className="text-xs font-medium text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 text-gray-600 truncate text-xs">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className="bg-brand-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 text-right text-xs text-gray-500">{value.toLocaleString()}</span>
    </div>
  );
}

function MiniLineChart({ data }: { data: { date: string; count: number }[] }) {
  if (data.length < 2) return <p className="text-xs text-gray-400">Not enough data</p>;
  const W = 600; const H = 80;
  const max = Math.max(...data.map(d => d.count)) || 1;
  const pts: [number, number][] = data.map((d, i) => [
    (i / (data.length - 1)) * W,
    H - 8 - (d.count / max) * (H - 16),
  ]);
  let line = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const cpX = (pts[i - 1][0] + pts[i][0]) / 2;
    line += ` C ${cpX},${pts[i - 1][1]} ${cpX},${pts[i][1]} ${pts[i][0]},${pts[i][1]}`;
  }
  const area = `${line} L ${pts[pts.length - 1][0]},${H} L ${pts[0][0]},${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
      <defs>
        <linearGradient id="al-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.15"/>
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={area} fill="url(#al-grad)"/>
      <path d={line} fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function AdminAnalyticsPage() {
  const [data, setData]   = useState<AdminAnalytics | null>(null);
  const [days, setDays]   = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.admin.analytics(days)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  const maxCountry = Math.max(...(data?.topCountries.map(c => c.count) ?? [0]));
  const deviceEntries = Object.entries(data?.deviceType ?? {}).sort((a, b) => b[1] - a[1]);
  const referrerEntries = Object.entries(data?.referrerType ?? {}).sort((a, b) => b[1] - a[1]);
  const viewerEntries  = Object.entries(data?.viewerType  ?? {}).sort((a, b) => b[1] - a[1]);
  const maxDevice   = Math.max(...deviceEntries.map(([, v]) => v), 0);
  const maxReferrer = Math.max(...referrerEntries.map(([, v]) => v), 0);
  const maxViewer   = Math.max(...viewerEntries.map(([, v]) => v), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-bold text-gray-900">Analytics</h1>
        <div className="flex gap-2">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${days === d ? "bg-brand-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-5">Page views on creator public profiles</p>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {Array(4).fill(0).map((_, i) => <div key={i} className="animate-pulse bg-gray-200 rounded-2xl h-24" />)}
        </div>
      ) : data ? (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <StatCard label="Total views" value={data.total} sub={`Last ${data.days} days`} />
            <StatCard label="Anonymous" value={data.viewerType["anonymous"] ?? 0} />
            <StatCard label="Business viewers" value={data.viewerType["business"] ?? 0} />
            <StatCard label="Creator viewers" value={data.viewerType["creator"] ?? 0} />
          </div>

          {/* Daily line chart */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm mb-5">
            <h2 className="text-sm font-bold text-gray-900 mb-1">Daily Views</h2>
            <p className="text-xs text-gray-400 mb-3">Last {data.days} days</p>
            <MiniLineChart data={data.dailyViews} />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-0.5">
              <span>{data.dailyViews[0]?.date}</span>
              <span>{data.dailyViews[data.dailyViews.length - 1]?.date}</span>
            </div>
          </div>

          {/* Breakdown grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <h2 className="text-sm font-bold text-gray-900 mb-3">Top Countries</h2>
              <div className="space-y-2">
                {data.topCountries.map(c => (
                  <BarRow key={c.country} label={c.country} value={c.count} max={maxCountry} />
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <h2 className="text-sm font-bold text-gray-900 mb-3">Viewer Type</h2>
              <div className="space-y-2">
                {viewerEntries.map(([k, v]) => <BarRow key={k} label={k} value={v} max={maxViewer} />)}
              </div>
              <h2 className="text-sm font-bold text-gray-900 mb-3 mt-5">Device Type</h2>
              <div className="space-y-2">
                {deviceEntries.map(([k, v]) => <BarRow key={k} label={k} value={v} max={maxDevice} />)}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <h2 className="text-sm font-bold text-gray-900 mb-3">Traffic Source</h2>
              <div className="space-y-2">
                {referrerEntries.map(([k, v]) => <BarRow key={k} label={k} value={v} max={maxReferrer} />)}
              </div>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-400">No data available.</p>
      )}
    </div>
  );
}
