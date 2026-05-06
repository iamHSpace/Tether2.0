"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { api, Conversation, ConversationMessage } from "@/lib/api";
import Sidebar from "@/components/layout/Sidebar";
import { IconMessage, IconSend, IconSearch, IconUser } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";

function timeShort(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initial = name?.[0]?.toUpperCase() ?? "?";
  const cls = size === "sm" ? "w-8 h-8 text-xs" : size === "lg" ? "w-12 h-12 text-base" : "w-10 h-10 text-sm";
  return (
    <div className={cn("rounded-xl bg-gradient-to-br from-brand-400 to-purple-600 flex items-center justify-center shrink-0 text-white font-bold", cls)}>
      {initial}
    </div>
  );
}

// ── Conversation list item ────────────────────────────────────────────────────

function ConvItem({ conv, active, myUserId, onClick }: {
  conv: Conversation;
  active: boolean;
  myUserId: string;
  onClick: () => void;
}) {
  const isMe = conv.last_message?.sender_id === myUserId;
  const preview = conv.last_message
    ? `${isMe ? "You: " : ""}${conv.last_message.body}`
    : "No messages yet";

  return (
    <button onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-3 rounded-xl flex items-center gap-3 transition-all",
        active ? "bg-brand-50 border border-brand-100" : "hover:bg-gray-50"
      )}>
      <Avatar name={conv.other_user.display_name} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <p className={cn("text-sm truncate", conv.unread_count > 0 ? "font-bold text-gray-900" : "font-semibold text-gray-800")}>
            {conv.other_user.display_name}
          </p>
          <span className="text-[10px] text-gray-400 shrink-0">{timeShort(conv.last_message_at)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <p className={cn("text-xs truncate flex-1", conv.unread_count > 0 ? "text-gray-700 font-medium" : "text-gray-400")}>
            {preview}
          </p>
          {conv.unread_count > 0 && (
            <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-brand-600 text-white min-w-[18px] text-center">
              {conv.unread_count > 9 ? "9+" : conv.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function Bubble({ msg, isMe }: { msg: ConversationMessage; isMe: boolean }) {
  return (
    <div className={cn("flex gap-2 max-w-[80%]", isMe ? "ml-auto flex-row-reverse" : "mr-auto")}>
      <div className={cn(
        "px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words",
        isMe
          ? "bg-brand-600 text-white rounded-br-sm"
          : "bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm"
      )}>
        {msg.body}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const [myUserId, setMyUserId]       = useState("");
  const [myUserType, setMyUserType]   = useState<"creator" | "business">("creator");
  const [myEmail, setMyEmail]         = useState("");
  const [myDisplayName, setMyDisplayName] = useState("");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId]   = useState<string | null>(null);
  const [messages, setMessages]           = useState<ConversationMessage[]>([]);
  const [msgInput, setMsgInput]           = useState("");

  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs]   = useState(false);
  const [sending, setSending]           = useState(false);
  const [convSearch, setConvSearch]     = useState("");

  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const realtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Initial load ─────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }

    setMyUserId(user.id);

    try {
      const { profile, email: em } = await api.profile.get();
      const ut = profile.user_type ?? "creator";
      setMyUserType(ut);
      setMyEmail(em ?? user.email ?? "");
      setMyDisplayName(
        ut === "business"
          ? (profile.company_name ?? profile.full_name ?? profile.username ?? "")
          : (profile.full_name ?? profile.username ?? "")
      );
    } catch {
      setMyEmail(user.email ?? "");
    }

    try {
      const { conversations: convs } = await api.conversations.list();
      setConversations(convs);

      // If URL has ?c= or ?with= param, open that conversation
      const params = new URLSearchParams(window.location.search);
      const convId = params.get("c");
      const withId = params.get("with");

      if (convId) {
        setActiveConvId(convId);
        window.history.replaceState({}, "", "/messages");
      } else if (withId) {
        try {
          const { conversation } = await api.conversations.start(withId);
          setActiveConvId(conversation.id);
          // Refresh conversation list to include the new one
          const { conversations: fresh } = await api.conversations.list();
          setConversations(fresh);
        } catch { /* non-fatal */ }
        window.history.replaceState({}, "", "/messages");
      }
    } catch { /* non-fatal */ }

    setLoadingConvs(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Load messages when active conv changes ────────────────────────────────

  useEffect(() => {
    if (!activeConvId) return;

    setLoadingMsgs(true);
    setMessages([]);

    api.conversations.messages(activeConvId)
      .then(({ messages: msgs }) => {
        setMessages(msgs);
        setLoadingMsgs(false);
        // Clear unread count locally
        setConversations(prev => prev.map(c =>
          c.id === activeConvId ? { ...c, unread_count: 0 } : c
        ));
      })
      .catch(() => setLoadingMsgs(false));
  }, [activeConvId]);

  // ── Scroll to bottom when messages change ─────────────────────────────────

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages]);

  // ── Realtime subscription ─────────────────────────────────────────────────

  useEffect(() => {
    if (realtimeRef.current) {
      realtimeRef.current.unsubscribe();
      realtimeRef.current = null;
    }

    if (!activeConvId || !myUserId) return;

    const channel = supabase
      .channel(`messages:${activeConvId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeConvId}`,
        },
        (payload) => {
          const newMsg = payload.new as ConversationMessage;
          setMessages(prev => {
            // Avoid duplicates (our own sent messages may already be in state)
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          // Update conversation preview
          setConversations(prev => prev.map(c =>
            c.id === activeConvId
              ? {
                  ...c,
                  last_message: { body: newMsg.body, sender_id: newMsg.sender_id, created_at: newMsg.created_at },
                  last_message_at: newMsg.created_at,
                }
              : c
          ));
        }
      )
      .subscribe();

    realtimeRef.current = channel;
    return () => { channel.unsubscribe(); realtimeRef.current = null; };
  }, [activeConvId, myUserId]);

  // ── Send message ──────────────────────────────────────────────────────────

  async function sendMessage() {
    const text = msgInput.trim();
    if (!text || !activeConvId || sending) return;

    setSending(true);
    setMsgInput("");

    try {
      const { message } = await api.conversations.send(activeConvId, text);
      // Add optimistically (realtime may also fire — deduplication handles it)
      setMessages(prev => prev.some(m => m.id === message.id) ? prev : [...prev, message]);
      setConversations(prev => prev.map(c =>
        c.id === activeConvId
          ? { ...c, last_message: { body: message.body, sender_id: message.sender_id, created_at: message.created_at }, last_message_at: message.created_at }
          : c
      ));
    } catch { /* non-fatal — message input already cleared */ }

    setSending(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const activeConv = conversations.find(c => c.id === activeConvId) ?? null;
  const filteredConvs = convSearch
    ? conversations.filter(c =>
        c.other_user.display_name.toLowerCase().includes(convSearch.toLowerCase()) ||
        (c.other_user.username ?? "").toLowerCase().includes(convSearch.toLowerCase())
      )
    : conversations;
  const totalUnread = conversations.reduce((s, c) => s + c.unread_count, 0);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-[#f5f0e8] overflow-hidden">
      <Sidebar
        email={myEmail}
        displayName={myDisplayName || undefined}
        userType={myUserType}
        unreadCount={totalUnread}
      />

      <main className="flex-1 overflow-hidden flex">
        {/* ── Conversation list ────────────────────────────────────────────── */}
        <div className="w-72 shrink-0 h-full flex flex-col bg-white/80 border-r border-white/80">
          <div className="px-4 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Messages</h2>
            <div className="relative">
              <IconSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={convSearch}
                onChange={e => setConvSearch(e.target.value)}
                placeholder="Search conversations…"
                className="input pl-8 py-2 text-xs w-full"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
            {loadingConvs ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-xl">
                  <div className="w-10 h-10 rounded-xl bg-gray-200 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-gray-200 animate-pulse rounded w-3/4" />
                    <div className="h-3 bg-gray-200 animate-pulse rounded w-1/2" />
                  </div>
                </div>
              ))
            ) : filteredConvs.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-2">
                  <IconMessage size={18} className="text-gray-300" />
                </div>
                <p className="text-xs text-gray-400">
                  {convSearch ? "No conversations match" : "No conversations yet"}
                </p>
                {!convSearch && (
                  <p className="text-[10px] text-gray-300 mt-1">
                    {myUserType === "creator"
                      ? "Browse Businesses to send a message"
                      : "Browse Discover to message a creator"}
                  </p>
                )}
              </div>
            ) : (
              filteredConvs.map(conv => (
                <ConvItem
                  key={conv.id}
                  conv={conv}
                  active={conv.id === activeConvId}
                  myUserId={myUserId}
                  onClick={() => setActiveConvId(conv.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Thread ───────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeConv ? (
            <>
              {/* Thread header */}
              <div className="bg-white/80 border-b border-white/80 px-6 py-3.5 flex items-center gap-3 shrink-0">
                <Avatar name={activeConv.other_user.display_name} size="sm" />
                <div>
                  <p className="text-sm font-bold text-gray-900">{activeConv.other_user.display_name}</p>
                  {activeConv.other_user.username && (
                    <p className="text-xs text-gray-400">@{activeConv.other_user.username}</p>
                  )}
                </div>
                <span className={`ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${
                  activeConv.other_user.user_type === "business"
                    ? "bg-blue-50 text-blue-600 border border-blue-100"
                    : "bg-purple-50 text-purple-600 border border-purple-100"
                }`}>
                  {activeConv.other_user.user_type}
                </span>
              </div>

              {/* Messages */}
              <div ref={threadRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
                {loadingMsgs ? (
                  <div className="flex justify-center py-12">
                    <span className="w-5 h-5 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center mb-3">
                      <IconMessage size={20} className="text-brand-400" />
                    </div>
                    <p className="text-sm font-semibold text-gray-700">Start the conversation</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Say hello to {activeConv.other_user.display_name}
                    </p>
                  </div>
                ) : (
                  messages.map(msg => (
                    <Bubble key={msg.id} msg={msg} isMe={msg.sender_id === myUserId} />
                  ))
                )}
              </div>

              {/* Input */}
              <div className="bg-white/80 border-t border-white/80 px-4 py-3 shrink-0">
                <div className="flex items-end gap-2 bg-white rounded-2xl border border-gray-200 px-3 py-2 shadow-sm focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-100 transition-all">
                  <textarea
                    ref={inputRef}
                    value={msgInput}
                    onChange={e => setMsgInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Message ${activeConv.other_user.display_name}…`}
                    className="flex-1 resize-none text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent max-h-32 min-h-[1.25rem] leading-tight"
                    rows={1}
                    maxLength={2000}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!msgInput.trim() || sending}
                    className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0">
                    <IconSend size={13} />
                  </button>
                </div>
                <p className="text-[10px] text-gray-300 mt-1.5 px-1">Enter to send · Shift+Enter for new line</p>
              </div>
            </>
          ) : (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center mb-4">
                <IconMessage size={28} className="text-brand-400" />
              </div>
              <h3 className="text-base font-bold text-gray-800 mb-1">Your messages</h3>
              <p className="text-sm text-gray-400 max-w-xs">
                {conversations.length > 0
                  ? "Select a conversation to read and reply"
                  : myUserType === "creator"
                    ? "Browse Businesses to find brands to message"
                    : "Browse Discover to find creators to message"}
              </p>
              {conversations.length === 0 && (
                <a
                  href={myUserType === "creator" ? "/businesses" : "/discover"}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700">
                  {myUserType === "creator" ? (
                    <><IconUser size={14} /> Browse Businesses</>
                  ) : (
                    <><IconUser size={14} /> Discover Creators</>
                  )}
                </a>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
