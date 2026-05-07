"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api, AdminUser } from "@/lib/api";

function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${color}`}>{label}</span>;
}

function Skeleton() {
  return <div className="animate-pulse bg-gray-200 rounded h-4 w-full" />;
}

export default function AdminUsersPage() {
  const [users, setUsers]         = useState<AdminUser[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [suspFilter, setSuspFilter] = useState("");
  const [loading, setLoading]     = useState(true);
  const [actionId, setActionId]   = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const limit = 25;

  const load = useCallback(async (pg: number, q: string, role: string, susp: string) => {
    setLoading(true);
    try {
      const res = await api.admin.users({ q, user_type: role || undefined, suspended: susp || undefined, page: pg, limit });
      setUsers(res.users);
      setTotal(res.total);
    } catch { /* non-fatal */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(page, search, roleFilter, suspFilter), 250);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter, suspFilter, page]);

  async function toggleSuspend(user: AdminUser) {
    setActionId(user.id);
    try {
      await api.admin.flagProfile(user.id, !user.is_suspended);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_suspended: !u.is_suspended } : u));
    } catch { /* non-fatal */ } finally { setActionId(null); }
  }

  async function deleteUser(user: AdminUser) {
    if (!confirm(`Delete @${user.username ?? user.id}? This is irreversible.`)) return;
    setActionId(user.id);
    try {
      await api.admin.deleteUser(user.id);
      setUsers(prev => prev.filter(u => u.id !== user.id));
      setTotal(t => t - 1);
    } catch { /* non-fatal */ } finally { setActionId(null); }
  }

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-lg font-bold text-gray-900 mb-1">Users</h1>
      <p className="text-sm text-gray-500 mb-5">{total} total accounts</p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search username, name…" className="input py-2 text-sm w-64" />
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
          className="input py-2 text-sm w-36">
          <option value="">All roles</option>
          <option value="creator">Creator</option>
          <option value="business">Business</option>
        </select>
        <select value={suspFilter} onChange={e => { setSuspFilter(e.target.value); setPage(1); }}
          className="input py-2 text-sm w-36">
          <option value="">All status</option>
          <option value="false">Active</option>
          <option value="true">Suspended</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["User", "Role", "Status", "Last active", "Joined", "Actions"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? Array(8).fill(0).map((_, i) => (
              <tr key={i}>
                {Array(6).fill(0).map((_, j) => (
                  <td key={j} className="px-4 py-3"><Skeleton /></td>
                ))}
              </tr>
            )) : users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900">{u.full_name ?? u.company_name ?? "—"}</p>
                    <p className="text-xs text-gray-400">@{u.username ?? u.id.slice(0, 8)}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <Badge label={u.user_type} color={u.user_type === "creator" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"} />
                    {u.is_admin && <Badge label="admin" color="bg-red-50 text-red-600" />}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    label={u.is_suspended ? "Suspended" : "Active"}
                    color={u.is_suspended ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"} />
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {u.last_active_at ? new Date(u.last_active_at).toLocaleDateString() : "Never"}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      disabled={actionId === u.id}
                      onClick={() => toggleSuspend(u)}
                      className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-all disabled:opacity-40 ${
                        u.is_suspended
                          ? "bg-green-50 text-green-700 hover:bg-green-100"
                          : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                      }`}>
                      {u.is_suspended ? "Unsuspend" : "Suspend"}
                    </button>
                    <button
                      disabled={actionId === u.id}
                      onClick={() => deleteUser(u)}
                      className="text-xs font-medium px-2.5 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-all disabled:opacity-40">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-500">Page {page} of {pages}</p>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
              ← Prev
            </button>
            <button disabled={page === pages} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
