"use client";

import { useEffect, useState, useCallback } from "react";
import { api, AdminUser, AdminConversationSummary, AdminConversationDetail } from "@/lib/api";

type Tab = "profiles" | "conversations";

// ── Profiles tab ──────────────────────────────────────────────────────────────

function ProfilesTab() {
  const [users, setUsers]   = useState<AdminUser[]>([]);
  const [total, setTotal]   = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage]     = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const limit = 25;

  const load = useCallback(async (pg: number, q: string) => {
    setLoading(true);
    try {
      const res = await api.admin.users({ q, page: pg, limit });
      setUsers(res.users); setTotal(res.total);
    } catch { /* non-fatal */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(page, search); }, [page, search, load]);

  async function toggleSuspend(user: AdminUser) {
    setActionId(user.id);
    try {
      await api.admin.flagProfile(user.id, !user.is_suspended);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_suspended: !u.is_suspended } : u));
    } catch { /* non-fatal */ } finally { setActionId(null); }
  }

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search…" className="input py-2 text-sm w-64" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["User", "Role", "Status", "Action"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? Array(6).fill(0).map((_, i) => (
              <tr key={i}>{Array(4).fill(0).map((_, j) => (
                <td key={j} className="px-4 py-3"><div className="animate-pulse bg-gray-200 rounded h-4 w-full" /></td>
              ))}</tr>
            )) : users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{u.full_name ?? u.company_name ?? "—"}</p>
                  <p className="text-xs text-gray-400">@{u.username ?? u.id.slice(0, 8)}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    u.user_type === "creator" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"
                  }`}>{u.user_type}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    u.is_suspended ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"
                  }`}>{u.is_suspended ? "Suspended" : "Active"}</span>
                </td>
                <td className="px-4 py-3">
                  <button disabled={actionId === u.id} onClick={() => toggleSuspend(u)}
                    className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-all disabled:opacity-40 ${
                      u.is_suspended ? "bg-green-50 text-green-700 hover:bg-green-100" : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                    }`}>
                    {u.is_suspended ? "Unsuspend" : "Suspend"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-gray-500">Page {page} of {pages} · {total} users</p>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 disabled:opacity-40 hover:bg-gray-50">← Prev</button>
            <button disabled={page === pages} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Conversations tab ─────────────────────────────────────────────────────────

function ConversationsTab() {
  const [convos, setConvos] = useState<AdminConversationSummary[]>([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminConversationDetail | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const limit = 25;

  useEffect(() => {
    setLoading(true);
    api.admin.conversations({ page, limit })
      .then(r => { setConvos(r.conversations); setTotal(r.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  async function openThread(id: string) {
    setLoadingThread(true);
    try { setSelected(await api.admin.conversation(id)); }
    catch { /* non-fatal */ } finally { setLoadingThread(false); }
  }

  const pages = Math.max(1, Math.ceil(total / limit));

  if (selected) {
    const { conversation: c, messages } = selected;
    return (
      <div>
        <button onClick={() => setSelected(null)} className="text-xs text-brand-600 font-medium mb-4 hover:underline">
          ← Back to conversations
        </button>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
            <p className="text-sm font-bold text-gray-900">{c.creator.name} ↔ {c.business.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">Started {new Date(c.created_at).toLocaleString()}</p>
          </div>
          <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
            {messages.map(m => {
              const isCreator = m.sender_id === c.creator.id;
              return (
                <div key={m.id} className={`flex ${isCreator ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-xs px-3.5 py-2 rounded-2xl text-sm ${
                    isCreator ? "bg-gray-100 text-gray-800" : "bg-brand-600 text-white"
                  }`}>
                    <p className="text-[10px] font-semibold mb-0.5 opacity-60">
                      {isCreator ? c.creator.name : c.business.name}
                    </p>
                    {m.body}
                    <p className="text-[9px] opacity-50 mt-1">{new Date(m.created_at).toLocaleString()}</p>
                  </div>
                </div>
              );
            })}
            {messages.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No messages yet.</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["Creator", "Business", "Last message", "Last active"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? Array(8).fill(0).map((_, i) => (
              <tr key={i}>{Array(4).fill(0).map((_, j) => (
                <td key={j} className="px-4 py-3"><div className="animate-pulse bg-gray-200 rounded h-4 w-full" /></td>
              ))}</tr>
            )) : convos.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => openThread(c.id)}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{c.creator.name}</p>
                  {c.creator.username && <p className="text-xs text-gray-400">@{c.creator.username}</p>}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{c.business.name}</p>
                  {c.business.username && <p className="text-xs text-gray-400">@{c.business.username}</p>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate">
                  {c.last_message?.body ?? "—"}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {c.last_message_at ? new Date(c.last_message_at).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {loadingThread && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 text-sm text-gray-600">Loading thread…</div>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-gray-500">Page {page} of {pages} · {total} conversations</p>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 disabled:opacity-40 hover:bg-gray-50">← Prev</button>
            <button disabled={page === pages} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminModerationPage() {
  const [tab, setTab] = useState<Tab>("profiles");

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-lg font-bold text-gray-900 mb-1">Moderation</h1>
      <p className="text-sm text-gray-500 mb-5">Suspend profiles or review conversations.</p>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-5">
        {(["profiles", "conversations"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
              tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}>{t}</button>
        ))}
      </div>

      {tab === "profiles" ? <ProfilesTab /> : <ConversationsTab />}
    </div>
  );
}
