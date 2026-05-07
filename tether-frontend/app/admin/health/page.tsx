"use client";

import { useEffect, useState } from "react";
import { api, AdminHealthCreator } from "@/lib/api";

const STATUS_STYLES: Record<string, string> = {
  healthy:       "bg-green-50 text-green-700",
  stale:         "bg-amber-50 text-amber-700",
  expiring_soon: "bg-orange-50 text-orange-700",
  disconnected:  "bg-gray-100 text-gray-500",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[status] ?? "bg-gray-100 text-gray-500"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

export default function AdminHealthPage() {
  const [creators, setCreators] = useState<AdminHealthCreator[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<{ succeeded: number; failed: number; total: number } | null>(null);

  useEffect(() => {
    api.admin.platformHealth()
      .then(r => { setCreators(r.creators); setTotal(r.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleTrigger() {
    setTriggering(true); setTriggerResult(null);
    try {
      const r = await api.admin.triggerSnapshot();
      setTriggerResult(r);
    } catch { /* non-fatal */ } finally { setTriggering(false); }
  }

  const counts = {
    healthy:       creators.filter(c => c.status === "healthy").length,
    stale:         creators.filter(c => c.status === "stale").length,
    expiring_soon: creators.filter(c => c.status === "expiring_soon").length,
    disconnected:  creators.filter(c => c.status === "disconnected").length,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-bold text-gray-900">Platform Health</h1>
        <button
          onClick={handleTrigger}
          disabled={triggering}
          className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-all">
          {triggering ? "Running…" : "▶ Trigger Snapshot Now"}
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-5">YouTube connection status for {total} creators</p>

      {triggerResult && (
        <div className="mb-4 p-4 rounded-xl bg-green-50 border border-green-100 text-sm text-green-800">
          Snapshot complete — {triggerResult.succeeded} succeeded, {triggerResult.failed} failed, {triggerResult.total} total.
        </div>
      )}

      {/* Summary cards */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: "Healthy",        value: counts.healthy,       color: "bg-green-50 text-green-700  border-green-100" },
            { label: "Stale (>2d)",    value: counts.stale,         color: "bg-amber-50 text-amber-700  border-amber-100" },
            { label: "Expiring soon",  value: counts.expiring_soon, color: "bg-orange-50 text-orange-700 border-orange-100" },
            { label: "Disconnected",   value: counts.disconnected,  color: "bg-gray-100 text-gray-600   border-gray-200" },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl p-4 border ${s.color}`}>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs font-medium mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["Creator", "Status", "Channel", "Token expires", "Last snapshot", "Snapshot age"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? Array(10).fill(0).map((_, i) => (
              <tr key={i}>{Array(6).fill(0).map((_, j) => (
                <td key={j} className="px-4 py-3"><div className="animate-pulse bg-gray-200 rounded h-4 w-full" /></td>
              ))}</tr>
            )) : creators.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{c.full_name ?? c.username ?? c.id.slice(0, 8)}</p>
                  {c.username && <p className="text-xs text-gray-400">@{c.username}</p>}
                </td>
                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-3 text-xs text-gray-600">{c.channel_name ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  {c.token_expiry
                    ? <>{new Date(c.token_expiry).toLocaleDateString()} {c.days_until_expiry !== null && <span className="text-gray-400">({c.days_until_expiry}d)</span>}</>
                    : "—"}
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  {c.last_snapshot ? new Date(c.last_snapshot).toLocaleDateString() : "Never"}
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  {c.snapshot_age_days !== null ? `${c.snapshot_age_days}d ago` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
