"use client";

import { useState } from "react";
import { IconShare, IconCheck } from "@/components/ui/Icons";

export function ShareButton() {
  const [copied, setCopied] = useState(false);

  function share() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={share}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 shadow-sm"
    >
      {copied ? <IconCheck size={12} className="text-green-500" /> : <IconShare size={12} />}
      {copied ? "Copied!" : "Share"}
    </button>
  );
}
