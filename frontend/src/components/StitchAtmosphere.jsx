import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles,
  ArrowRight,
  Music,
  Tent,
  Compass,
  Layers,
  Sliders,
} from "lucide-react";

/**
 * -----------------------------------------------------------------------------
 * STITCH AURORA BACKGROUND
 * Pure CSS/SVG high-performance ambient fluid wave & dot grid (60fps hardware accelerated).
 * -----------------------------------------------------------------------------
 */
export function StitchAuroraBackground({ children, className = "", showGrid = true }) {
  return (
    <div className={`relative overflow-hidden bg-[#030306] ${className}`}>
      {/* 1. Dot-Matrix Blueprint Grid with Radial Lens Vignette */}
      {showGrid && (
        <div
          className="pointer-events-none absolute inset-0 z-0 opacity-60 stitch-grid-canvas"
          aria-hidden="true"
        />
      )}

      {/* 2. Fluid Aurora Energy Waves (Multi-Layer Flowing Splines) */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        {/* Deep Ambient Underglow */}
        <div
          className="absolute -top-[10%] left-[15%] h-[550px] w-[70%] rounded-full opacity-40 blur-[120px]"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(79, 70, 229, 0.35), rgba(147, 51, 234, 0.25), transparent 70%)",
          }}
        />

        {/* Primary Flowing Aurora Spline 1 (Electric Violet / Indigo) */}
        <div className="absolute top-[20%] left-[-10%] h-[320px] w-[120%] -rotate-6 rounded-[100%] opacity-70 blur-[75px] stitch-aurora-ribbon-1" />

        {/* Secondary Flowing Aurora Spline 2 (Electric Cyan / Royal Blue Accent) */}
        <div className="absolute top-[32%] -left-[5%] h-[260px] w-[110%] rotate-3 rounded-[100%] opacity-60 blur-[85px] stitch-aurora-ribbon-2" />

        {/* Subtle Ambient Radial Highlight */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: "radial-gradient(700px circle at 50% 40%, rgba(255, 255, 255, 0.08), transparent 70%)",
          }}
        />
      </div>

      {/* 3. Foreground Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/**
 * -----------------------------------------------------------------------------
 * GOOGLE STITCH-GRADE HERO COMMAND CAPSULE
 * High-refraction floating command center with mode switcher & suggestion chips.
 * -----------------------------------------------------------------------------
 */
export function StitchHeroCommandCapsule({ className = "" }) {
  const navigate = useNavigate();
  const [selectedMode, setSelectedMode] = useState("concert");
  const [prompt, setPrompt] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const MODES = [
    { id: "concert", label: "Konser Live", icon: Music },
    { id: "festival", label: "Music Fest", icon: Tent },
    { id: "tour", label: "Tour Production", icon: Compass },
    { id: "conference", label: "Conference", icon: Layers },
  ];

  const SUGGESTIONS = [
    {
      label: "Konser 15.000 pax di GBK Senayan",
      fullPrompt:
        "Rancang blueprint konser musik 15.000 penonton di Stadion GBK Senayan dengan kalkulasi staging, rider artist & ticketing multi-kategori.",
      mode: "concert",
    },
    {
      label: "Makassar Jazz Fest 3-Panggung",
      fullPrompt:
        "Simulasikan festival jazz 2 hari di Pantai Losari Makassar dengan 3 stage paralel, alokasi 40 vendor kuliner, dan settlement sponsor.",
      mode: "festival",
    },
    {
      label: "Break-even tiket & target sponsor Rp 2.5 M",
      fullPrompt:
        "Analisis sensitivitas target sponsor Rp 2.5 Miliar dan titik impas tiket VIP & Festival untuk live show di Surabaya.",
      mode: "concert",
    },
    {
      label: "Arena Tour 5 Kota Jawa-Bali",
      fullPrompt:
        "Susun jadwal logistik, timeline loading, vendor audio visual, dan proteksi pembayaran untuk tur arena di 5 kota.",
      mode: "tour",
    },
  ];

  const handleApplySuggestion = (item) => {
    setSelectedMode(item.mode);
    setPrompt(item.fullPrompt);
  };

  const handleExecute = (e) => {
    if (e) e.preventDefault();
    if (prompt.trim()) {
      navigate(`/demo?query=${encodeURIComponent(prompt.trim())}&mode=${selectedMode}`);
    } else {
      navigate("/register");
    }
  };

  return (
    <div className={`w-full max-w-4xl mx-auto ${className}`} data-testid="stitch-command-capsule">
      {/* Outer Floating Glass Capsule */}
      <div
        className={`relative rounded-3xl border transition-all duration-300 ${
          isFocused
            ? "border-white/[0.3] bg-[#0d0d1c]/95 shadow-[0_28px_90px_rgba(0,0,0,0.95),0_0_60px_rgba(99,102,241,0.25),inset_0_1px_0_rgba(255,255,255,0.35)]"
            : "border-white/[0.14] bg-[#0a0a14]/85 shadow-[0_24px_80px_rgba(0,0,0,0.85),0_0_40px_rgba(79,70,229,0.12),inset_0_1px_0_rgba(255,255,255,0.18)]"
        } backdrop-blur-3xl p-4 sm:p-5 text-left`}
      >
        {/* Top Atmosphere Subtle Specular Highlight */}
        <div className="absolute top-0 left-12 right-12 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />

        <form onSubmit={handleExecute} className="flex flex-col gap-4">
          {/* Main Prompt Input Area (Top - Google Stitch Style) */}
          <div className="relative">
            <textarea
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="What live event shall we design? (e.g. Konser 15.000 pax di Senayan, kalkulasi staging, rider & tiket)..."
              className="w-full resize-none bg-transparent px-1 py-1 text-base sm:text-lg text-white placeholder-zinc-500 outline-none focus:ring-0 leading-relaxed font-gemini"
            />
          </div>

          {/* Bottom Control Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/[0.08]">
            {/* Left: Mode Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              {MODES.map((mode) => {
                const Icon = mode.icon;
                const isActive = selectedMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setSelectedMode(mode.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                      isActive
                        ? "bg-white text-black font-bold shadow-md scale-[1.02]"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]"
                    }`}
                  >
                    <Icon size={13} className={isActive ? "text-black" : "text-zinc-400"} />
                    <span>{mode.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Right: Engine Indicator + Simulate CTA */}
            <div className="flex items-center gap-3">
              <div className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 font-gemini-mono">
                <Sparkles size={11} className="text-indigo-400" />
                <span>OKKAX Studio AI · v2.5</span>
              </div>

              <button
                type="submit"
                className="group inline-flex items-center gap-2 rounded-xl bg-white hover:bg-zinc-200 px-5 py-2.5 text-xs font-bold text-black shadow-[0_4px_20px_rgba(255,255,255,0.2)] transition-all duration-200 active:scale-[0.98] cursor-pointer"
              >
                <span>Simulasikan Event</span>
                <ArrowRight
                  size={14}
                  className="transition-transform duration-200 group-hover:translate-x-1"
                />
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Floating Interactive Suggestion Chips (Centered single/balanced row) */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5 px-1">
        {SUGGESTIONS.map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleApplySuggestion(item)}
            className="group inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-[#0c0c16]/80 backdrop-blur-xl px-4 py-2 text-xs font-medium text-zinc-300 hover:border-white/35 hover:bg-white/[0.1] hover:text-white transition-all duration-200 shadow-sm cursor-pointer active:scale-95"
          >
            <Sparkles size={11} className="text-zinc-400 group-hover:text-white transition-colors" />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

