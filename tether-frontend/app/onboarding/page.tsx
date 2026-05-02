"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

// ── Step data ────────────────────────────────────────────────────────────────

const JOURNEY_STEPS = [
  { id: "just_starting", emoji: "🌱", label: "Just starting out", desc: "Under 1K followers, still finding my niche" },
  { id: "growing",       emoji: "🚀", label: "Growing fast",      desc: "1K – 50K followers, building momentum" },
  { id: "established",   emoji: "⭐", label: "Established",       desc: "50K – 500K, partnering with brands" },
  { id: "pro",           emoji: "👑", label: "Pro creator",       desc: "500K+, full-time creative career" },
];

const ASPIRATIONS = [
  { id: "influencer",    emoji: "📣", label: "Influencer",        desc: "Grow my audience and personal brand" },
  { id: "brand_creator", emoji: "🎨", label: "Brand Creator",     desc: "Build content for brands & agencies" },
  { id: "educator",      emoji: "📚", label: "Educator",          desc: "Teach and share knowledge at scale" },
  { id: "entertainer",   emoji: "🎬", label: "Entertainer",       desc: "Entertain millions with creative content" },
];

const REASONS = [
  { id: "track_metrics",  emoji: "📊", label: "Track my metrics",        desc: "See all my stats in one place" },
  { id: "work_brands",    emoji: "🤝", label: "Work with brands",         desc: "Get discovered by agencies and sponsors" },
  { id: "share_proof",    emoji: "🔗", label: "Share verified proof",     desc: "Prove my reach without screenshots" },
  { id: "grow_audience",  emoji: "📈", label: "Grow my audience",         desc: "Understand what content performs best" },
];

const STEPS = [
  { title: "Where are you in your creator journey?", subtitle: "Help us personalise your experience", options: JOURNEY_STEPS },
  { title: "What do you aspire to be?",              subtitle: "We'll tailor insights to your goals",  options: ASPIRATIONS  },
  { title: "Why are you on Tether?",                 subtitle: "So we know what to show you first",   options: REASONS      },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [step, setStep]       = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [username, setUsername] = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const current   = STEPS[step];
  const selected  = answers[step];
  const isLast    = step === STEPS.length - 1;

  function pick(id: string) { setAnswers(prev => ({ ...prev, [step]: id })); }

  async function next() {
    if (!selected) return;
    if (isLast) { await save(); return; }
    setStep(s => s + 1);
  }

  async function save() {
    setSaving(true); setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      await supabase.from("profiles").upsert({
        id: user.id,
        username: username.trim() || user.email?.split("@")[0],
        creator_stage:   answers[0],
        aspiration:      answers[1],
        platform_reason: answers[2],
        onboarding_done: true,
      });

      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-purple-50 flex flex-col items-center justify-center p-4">
      {/* Progress bar */}
      <div className="w-full max-w-xl mb-8">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((_, i) => (
            <div key={i} className="flex items-center flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                i < step ? "bg-brand-600 text-white" :
                i === step ? "bg-brand-600 text-white ring-4 ring-brand-100" :
                "bg-gray-200 text-gray-400"
              }`}>
                {i < step ? "✓" : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-1 mx-2 rounded-full transition-all duration-500 ${i < step ? "bg-brand-500" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 text-right">Step {step + 1} of {STEPS.length}</p>
      </div>

      {/* Card */}
      <div className="card p-8 w-full max-w-xl page-enter">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">{current.title}</h2>
          <p className="text-sm text-gray-500 mt-1">{current.subtitle}</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-6">
          {current.options.map(opt => (
            <button
              key={opt.id}
              onClick={() => pick(opt.id)}
              className={`text-left p-4 rounded-xl border-2 transition-all duration-150 hover:border-brand-300 hover:bg-brand-50 ${
                selected === opt.id
                  ? "border-brand-500 bg-brand-50 shadow-sm"
                  : "border-gray-100 bg-white"
              }`}
            >
              <div className="text-2xl mb-2">{opt.emoji}</div>
              <div className={`text-sm font-semibold ${selected === opt.id ? "text-brand-700" : "text-gray-800"}`}>{opt.label}</div>
              <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{opt.desc}</div>
            </button>
          ))}
        </div>

        {/* Username on last step */}
        {isLast && (
          <div className="mb-6 p-4 rounded-xl bg-gray-50 border border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Choose your public username
              <span className="text-gray-400 font-normal ml-1">(optional)</span>
            </label>
            <div className="flex items-center">
              <span className="text-gray-400 text-sm mr-1">tether.app/</span>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                placeholder="yourcreatorname"
                className="input flex-1"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Letters, numbers, underscores and hyphens only.</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          {step > 0 ? (
            <button onClick={() => setStep(s => s - 1)} className="btn-secondary text-sm px-4 py-2.5">
              ← Back
            </button>
          ) : <div />}

          <button
            onClick={next}
            disabled={!selected || saving}
            className="btn-primary text-sm px-6 py-2.5 disabled:opacity-40"
          >
            {saving ? "Saving…" : isLast ? "Go to dashboard →" : "Continue →"}
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-4">
        You can update these anytime in Settings.
      </p>
    </div>
  );
}
