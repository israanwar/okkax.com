/**
 * CopilotWorkspace.jsx — OKKAX Copilot canonical workspace.
 *
 * MOBILE-FIRST: 390px is primary acceptance viewport.
 * One canonical component for /copilot and /app/copilot.
 * Receives all state as props — zero API calls here.
 *
 * FUNCTIONAL STATES (per spec):
 *   ACTIVE      — real functionality works
 *   UNAVAILABLE — no backend implementation; not shown
 *
 * REMOVED (per audit & spec):
 *   - Paperclip/attach    — no upload wired
 *   - Speed mode buttons  — no backend parameter, all modes identical
 *   - History restore     — localStorage titles only, restore not real
 *   - Center logo/hero    — center intentionally blank (spec §6)
 *   - Colored evidence chips — replaced with monochrome (spec §17)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays, Wallet, Building2, Mic2, Wrench, HardHat,
  Handshake, Store, Ticket, Network, MapPin, Globe2, Sparkles,
  Calculator, Plus, Search, X, ArrowUp,
  AlertCircle, Copy, Check, RefreshCw, ArrowUpRight,
  Wand2, LogIn, AlignLeft,
} from "lucide-react";

// Every launcher item has an explicit contract: a real route, a real Copilot
// workflow, or a visible unavailable state.
const COMMANDS = [
  { id: "event-studio", label: "Event Studio", icon: Wand2, behavior: "NAVIGATION", to: "/app/studio" },
  { id: "event-graph", label: "Event Graph", icon: Network, behavior: "NAVIGATION", to: "/app/events" },
  { id: "calendar", label: "Calendar", icon: CalendarDays, behavior: "NAVIGATION", to: "/app/calendar" },
  { id: "event-planning", label: "Event Planning", icon: CalendarDays, behavior: "COPILOT_WORKFLOW", prompt: "Rancang event, kapasitas, kota, budget...", starter: "Bantu rancang event: " },
  { id: "finance-budget", label: "Finance & Budget", icon: Wallet, behavior: "COPILOT_WORKFLOW", prompt: "Hitung budget, BEP, funding, atau skenario...", starter: "Analisis budget dan BEP untuk: " },
  { id: "venue", label: "Venue", icon: Building2, behavior: "COPILOT_WORKFLOW", prompt: "Cari atau evaluasi venue untuk...", starter: "Cari atau evaluasi venue untuk: " },
  { id: "talent", label: "Talent", icon: Mic2, behavior: "COPILOT_WORKFLOW", prompt: "Cari atau evaluasi talent untuk...", starter: "Cari atau evaluasi talent untuk: " },
  { id: "vendor", label: "Vendor", icon: Wrench, behavior: "COPILOT_WORKFLOW", prompt: "Cari vendor atau evaluasi quotation...", starter: "Cari vendor atau evaluasi quotation: " },
  { id: "workforce", label: "Workforce", icon: HardHat, behavior: "COPILOT_WORKFLOW", prompt: "Hitung atau rencanakan workforce...", starter: "Hitung atau rencanakan workforce untuk: " },
  { id: "sponsor", label: "Sponsor", icon: Handshake, behavior: "COPILOT_WORKFLOW", prompt: "Analisis sponsor, package, atau funding...", starter: "Analisis sponsor, package, atau funding untuk: " },
  { id: "tenant", label: "Tenant", icon: Store, behavior: "COPILOT_WORKFLOW", prompt: "Rencanakan tenant dan zonasi...", starter: "Rencanakan tenant dan zonasi untuk: " },
  { id: "ticketing", label: "Ticketing", icon: Ticket, behavior: "COPILOT_WORKFLOW", prompt: "Hitung pricing, inventory, atau break-even...", starter: "Hitung pricing, inventory, atau break-even untuk: " },
  { id: "maps-local", label: "Maps & Local", icon: MapPin, behavior: "UNAVAILABLE" },
  { id: "web-research", label: "Web Research", icon: Globe2, behavior: "UNAVAILABLE" },
  { id: "intelligence", label: "Intelligence", icon: Sparkles, behavior: "COPILOT_WORKFLOW", prompt: "Analisis intelijen mendalam...", starter: "Analisis intelijen untuk: " },
  { id: "calculator", label: "Calculator", icon: Calculator, behavior: "COPILOT_WORKFLOW", prompt: "Hitung...", starter: "Hitung: " },
];

// ─── Inline markdown formatter ───────────────────────────────────────────────
function inlineFormat(text) {
  if (!text || typeof text !== "string") return text;
  const parts = [];
  const rx = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0, m;
  while ((m = rx.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("`")) {
      parts.push(
        <code key={m.index} className="rounded px-1 py-0.5 font-gemini-mono text-[11px]"
          style={{ background: "var(--cp-surface-2)", color: "var(--cp-text)", border: "1px solid var(--cp-border)" }}>
          {tok.slice(1, -1)}
        </code>
      );
    } else if (tok.startsWith("**")) {
      parts.push(<strong key={m.index} className="font-semibold" style={{ color: "var(--cp-text)" }}>{tok.slice(2, -2)}</strong>);
    } else {
      parts.push(<span key={m.index} style={{ color: "var(--cp-text)" }}>{tok.slice(1, -1)}</span>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : text;
}

// ─── Markdown block renderer ─────────────────────────────────────────────────
function CopilotMarkdown({ content }) {
  if (!content) return null;
  const lines = content.split("\n");
  const els = [];
  let keyIdx = 0;
  let tableRows = [];
  let inTable = false;

  const flushTable = () => {
    if (tableRows.length < 1) return;
    const header = tableRows[0];
    const data = tableRows.length > 2 ? tableRows.slice(2) : [];
    els.push(
      <div key={"tbl-" + keyIdx++} className="my-3 overflow-x-auto rounded border" style={{ borderColor: "var(--cp-border)", maxWidth: "100%" }}>
        <table className="w-full border-collapse text-left text-[12px] font-gemini">
          <thead style={{ background: "var(--cp-surface-2)", borderBottom: "1px solid var(--cp-border)" }}>
            <tr>{header.map((c, i) => <th key={i} className="px-3 py-2 text-[10.5px] font-semibold whitespace-nowrap" style={{ color: "var(--cp-text)" }}>{c.trim()}</th>)}</tr>
          </thead>
          <tbody>
            {data.map((row, ri) => (
              <tr key={ri} style={{ borderTop: "1px solid var(--cp-border)" }}>
                {row.map((c, ci) => <td key={ci} className="px-3 py-2 text-[12px] tabular-nums align-top" style={{ color: "var(--cp-muted)" }}>{inlineFormat(c.trim())}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = []; inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (t.startsWith("|") && t.endsWith("|")) {
      inTable = true;
      tableRows.push(line.split("|").slice(1, -1));
      continue;
    } else if (inTable) { flushTable(); }
    if (t === "") { continue; }
    if (t === "---" || t === "***") {
      els.push(<hr key={"hr-" + keyIdx++} className="my-3" style={{ borderColor: "var(--cp-border)" }} />);
    } else if (line.startsWith("### ")) {
      els.push(<h4 key={"h3-" + keyIdx++} className="mt-4 mb-1 text-[12.5px] font-semibold font-gemini-display first:mt-0" style={{ color: "var(--cp-text)" }}>{inlineFormat(line.replace("### ", ""))}</h4>);
    } else if (line.startsWith("## ")) {
      els.push(<h3 key={"h2-" + keyIdx++} className="mt-4 mb-1 text-[13.5px] font-semibold font-gemini-display first:mt-0" style={{ color: "var(--cp-text)" }}>{inlineFormat(line.replace("## ", ""))}</h3>);
    } else if (line.startsWith("# ")) {
      els.push(<h2 key={"h1-" + keyIdx++} className="mt-4 mb-1.5 text-[14px] font-semibold font-gemini-display first:mt-0" style={{ color: "var(--cp-text)" }}>{inlineFormat(line.replace("# ", ""))}</h2>);
    } else if (t.startsWith("> ")) {
      els.push(<blockquote key={"bq-" + keyIdx++} className="my-2 pl-3 border-l-2 text-[13px] leading-relaxed" style={{ borderColor: "var(--cp-subtle)", color: "var(--cp-muted)" }}>{inlineFormat(t.slice(2))}</blockquote>);
    } else if (t.startsWith("- ") || t.startsWith("* ")) {
      els.push(
        <div key={"li-" + keyIdx++} className="my-1 flex items-start gap-2 text-[13px] leading-[1.65]" style={{ color: "var(--cp-text)" }}>
          <span className="mt-[9px] h-[3px] w-[3px] shrink-0 rounded-full" style={{ background: "var(--cp-subtle)" }} />
          <span className="min-w-0 flex-1">{inlineFormat(t.slice(2))}</span>
        </div>
      );
    } else if (/^\d+\.\s/.test(t)) {
      const mm = t.match(/^(\d+)\.\s(.*)$/);
      if (mm) els.push(
        <div key={"ol-" + keyIdx++} className="my-1 flex items-start gap-2 text-[13px] leading-[1.65]" style={{ color: "var(--cp-text)" }}>
          <span className="shrink-0 min-w-[16px] font-gemini-mono text-[10.5px] font-semibold" style={{ color: "var(--cp-muted)" }}>{mm[1]}.</span>
          <span className="min-w-0 flex-1">{inlineFormat(mm[2])}</span>
        </div>
      );
    } else {
      els.push(<p key={"p-" + keyIdx++} className="my-1.5 text-[13px] leading-[1.7] first:mt-0 last:mb-0" style={{ color: "var(--cp-text)" }}>{inlineFormat(line)}</p>);
    }
  }
  if (inTable) flushTable();
  return els.length ? <>{els}</> : null;
}

// ─── Context Inspector Panel ─────────────────────────────────────────────────
// MONOCHROME only. Only renders sections when real data is present.
function getContextItems(activeResult) {
  const result = activeResult || {};
  const plan = result.semantic_plan || {};
  const entities = plan.entities || {};
  const constraints = plan.constraints || {};
  const event = result.event || result.event_context || result.context?.event || {};
  const items = [];
  const add = (section, label, value) => {
    if (value !== undefined && value !== null && value !== "") items.push({ section, label, value });
  };
  add("CURRENT EVENT", "Name", event.name || event.event_name);
  add("CURRENT EVENT", "ID", event.id || result.event_id);
  add("CURRENT EVENT", "City", event.city || entities.city);
  add("CURRENT EVENT", "Type", event.event_type || entities.event_type);
  add("CURRENT EVENT", "Capacity", event.capacity || constraints.capacity ? `${(event.capacity || constraints.capacity).toLocaleString("id-ID")} pax` : null);
  add("CONSTRAINTS", "Budget ceiling", constraints.budget || constraints.baseline ? formatIdr(constraints.budget || constraints.baseline) : null);
  add("CONSTRAINTS", "Locked", (constraints.constraint_tags || []).join(", "));
  const financial = result.financial_state || result.financial || {};
  add("FINANCIAL", "Funding gap", financial.funding_gap || result.funding_gap ? formatIdr(financial.funding_gap || result.funding_gap) : null);
  add("FINANCIAL", "Known funding", financial.committed || financial.received ? formatIdr(financial.committed || financial.received) : null);
  const sources = [];
  if (result.grounded) sources.push("OKKAX data");
  if (result.source === "knowledge_note" || result.reasoning_mode === "knowledge") sources.push("Knowledge");
  if (result.source === "direct_calculation" || result.reasoning_mode === "deterministic") sources.push("Calculator");
  if (result.event_graph || result.source?.includes("event_graph")) sources.push("Event Graph");
  if (sources.length) add("SOURCES", "Used", [...new Set(sources)].join(", "));
  return items;
}

function formatIdr(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(numeric) : String(value);
}

function ContextPanel({ activeResult }) {
  const items = getContextItems(activeResult);
  const sections = [...new Set(items.map(item => item.section))];

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-3 py-2.5 border-b" style={{ borderColor: "var(--cp-border)" }}>
        <span className="text-[9.5px] font-bold uppercase tracking-[0.18em] font-gemini-mono" style={{ color: "var(--cp-muted)" }}>
          Context Inspector
        </span>
      </div>
      <div className="flex-1 overflow-y-auto cp-scroll px-3 py-3 space-y-4 min-h-0">
        {sections.map(section => (
          <section key={section}>
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] mb-2 font-gemini-mono" style={{ color: "var(--cp-muted)" }}>{section}</p>
            <div className="space-y-1.5">
              {items.filter(item => item.section === section).map(item => (
                <div key={item.label} className="flex items-start justify-between gap-2">
                  <span className="text-[11px] shrink-0" style={{ color: "var(--cp-muted)" }}>{item.label}</span>
                  <span className="text-[11px] font-medium text-right break-words" style={{ color: "var(--cp-text)" }}>{item.value}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

// ─── Nav content (shared: desktop sidebar + mobile drawer) ───────────────────
function NavContent({ mode, activeWorkflow, onToolClick, onNewChat, searchQuery, onSearchChange, onClose }) {
  const filtered = COMMANDS.filter(t => t.label.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Mobile drawer header */}
      {onClose && (
        <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b" style={{ borderColor: "var(--cp-border)" }}>
          <span className="text-[9.5px] font-bold uppercase tracking-[0.18em] font-gemini-mono" style={{ color: "var(--cp-muted)" }}>Navigation</span>
          <button onClick={onClose}
            className="p-2 rounded-lg cursor-pointer transition-colors"
            style={{ color: "var(--cp-muted)" }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--cp-hover)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            aria-label="Close navigation">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Workspace section */}
      <div className="px-2 pt-3 pb-1 shrink-0">
        <p className="px-2 mb-1.5 text-[9px] font-bold uppercase tracking-[0.18em] font-gemini-mono" style={{ color: "var(--cp-muted)" }}>
          Workspace
        </p>
        <button onClick={() => { onNewChat(); onClose?.(); }}
          data-testid="copilot-ws-new-chat"
          className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium transition-colors cursor-pointer"
          style={{ color: "var(--cp-text)" }}
          onMouseEnter={e => e.currentTarget.style.background = "var(--cp-hover)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
          <Plus size={13} className="shrink-0" style={{ color: "var(--cp-muted)" }} />
          New Chat
        </button>
        <div className="relative mt-1.5">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--cp-muted)" }} />
          <input
            value={searchQuery} onChange={e => onSearchChange(e.target.value)}
            placeholder="Search"
            data-testid="copilot-ws-search"
            aria-label="Search commands"
            className="w-full pl-7 pr-2.5 py-1.5 text-[11.5px] rounded-lg border font-gemini transition-colors"
            style={{ background: "var(--cp-surface)", borderColor: "var(--cp-border)", color: "var(--cp-text)", outline: "none" }}
          />
        </div>
      </div>

      <div className="mx-3 my-2 shrink-0" style={{ height: "1px", background: "var(--cp-border)" }} />

      {/* Command launcher */}
      <div className="flex-1 overflow-y-auto cp-scroll pb-3 min-h-0">
        <p className="px-3 mb-1 text-[9px] font-bold uppercase tracking-[0.18em] font-gemini-mono" style={{ color: "var(--cp-muted)" }}>Commands</p>
        {filtered.map(tool => {
          const Icon = tool.icon;
          if (tool.behavior === "NAVIGATION") {
            return <Link key={tool.id} to={tool.to} onClick={onClose} data-testid={"copilot-ws-nav-" + tool.id}
              className="flex items-center gap-2.5 px-3 py-1.5 text-[12px] transition-colors"
              style={{ color: "var(--cp-muted)" }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--cp-text)"; e.currentTarget.style.background = "var(--cp-hover)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--cp-muted)"; e.currentTarget.style.background = "transparent"; }}>
              <Icon size={12} className="shrink-0" /><span className="truncate">{tool.label}</span>
            </Link>;
          }
          return (
            <button key={tool.id} onClick={() => { if (tool.behavior === "COPILOT_WORKFLOW") { onToolClick(tool); onClose?.(); } }} disabled={tool.behavior === "UNAVAILABLE"}
              data-testid={"copilot-ws-tool-" + tool.id}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] transition-colors"
              style={{ color: tool.behavior === "UNAVAILABLE" ? "var(--cp-subtle)" : tool.id === activeWorkflow ? "var(--cp-text)" : "var(--cp-muted)", cursor: tool.behavior === "UNAVAILABLE" ? "not-allowed" : "pointer" }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--cp-text)"; e.currentTarget.style.background = "var(--cp-hover)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = tool.id === activeWorkflow ? "var(--cp-text)" : "var(--cp-muted)"; e.currentTarget.style.background = "transparent"; }}>
              <Icon size={12} className="shrink-0" />
              <span className="truncate">{tool.label}</span>
            </button>
          );
        })}

      </div>
    </div>
  );
}

// ─── Bottom sheet drawer (mobile — context) ──────────────────────────────────
function BottomDrawer({ isOpen, onClose, title, children }) {
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 flex flex-col rounded-t-xl"
        style={{ background: "var(--cp-surface)", borderTop: "1px solid var(--cp-border)", maxHeight: "86dvh" }}>
        <div className="flex justify-center pt-2.5 pb-0 shrink-0">
          <div className="h-1 w-8 rounded-full" style={{ background: "var(--cp-subtle)" }} />
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 shrink-0 border-b" style={{ borderColor: "var(--cp-border)" }}>
          <span className="text-[13px] font-semibold" style={{ color: "var(--cp-text)" }}>{title}</span>
          <button onClick={onClose}
            className="p-2 rounded-lg cursor-pointer transition-colors"
            style={{ color: "var(--cp-muted)" }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--cp-hover)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            aria-label="Close">
            <X size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto cp-scroll min-h-0">{children}</div>
      </div>
    </div>
  );
}

// ─── Left nav drawer (mobile — slides from left) ─────────────────────────────
function NavDrawer({ isOpen, onClose, children }) {
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose} />
      <div className="absolute left-0 top-0 h-full flex flex-col"
        style={{ width: "min(280px, 85vw)", background: "var(--cp-rail)", borderRight: "1px solid var(--cp-border)" }}>
        {children}
      </div>
    </div>
  );
}

// ─── Composer bar ─────────────────────────────────────────────────────────────
function ComposerBar({ input, onInputChange, onSend, loading, onNavOpen, onContextOpen, onClearWorkflow, activeWorkflow, contextAvailable }) {
  const textareaRef = useRef(null);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
  };

  // Auto-resize textarea (up to ~5 lines)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [input]);

  const canSend = input.trim().length > 0 && !loading;

  return (
    <div className="shrink-0 px-3 pt-2 border-t"
      style={{ background: "var(--cp-bg)", borderColor: "var(--cp-border)", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
      {/* Mobile quick action row */}
      <div className="flex items-center gap-1.5 mb-2 lg:hidden">
        <button onClick={onNavOpen} data-testid="copilot-ws-nav-btn"
          className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-[11px] font-medium cursor-pointer transition-colors shrink-0"
          style={{ background: "var(--cp-badge)", borderColor: "var(--cp-border)", color: "var(--cp-badge-text)" }}
          aria-label="Open navigation">
          <AlignLeft size={12} /><span>Tools</span>
        </button>
        {contextAvailable && <button onClick={onContextOpen} data-testid="copilot-ws-context-toggle"
          className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-[11px] font-medium cursor-pointer transition-colors shrink-0"
          style={{ background: "var(--cp-badge)", borderColor: "var(--cp-border)", color: "var(--cp-badge-text)" }}
          aria-label="Open context inspector">
          Context
        </button>}
      </div>
      {/* Input row */}
      <div className="flex items-end gap-2 rounded-xl border px-3 pt-2.5 pb-2 transition-colors"
        style={{ background: "var(--cp-surface)", borderColor: "var(--cp-border)" }}>
        {activeWorkflow && <button type="button" onClick={onClearWorkflow} className="mb-1 shrink-0 border-r pr-2 text-[10px] font-gemini-mono text-zinc-300" aria-label="Clear workflow">{activeWorkflow.label}</button>}
        <textarea ref={textareaRef} value={input}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={activeWorkflow?.prompt || "Tanyakan event, budget, venue, talent, vendor, atau simulasi finansial…"}
          rows={1} disabled={loading}
          data-testid="copilot-ws-input"
          aria-label="Pesan untuk Okkax Copilot"
          aria-multiline="true"
          className="cp-textarea flex-1 min-w-0 text-[13px] leading-[1.6] disabled:opacity-50 font-gemini"
          style={{ color: "var(--cp-text)", resize: "none", overflow: "hidden", minHeight: "28px", maxHeight: "120px" }}
        />
        <button type="button" onClick={() => onSend()} disabled={!canSend}
          data-testid="copilot-ws-send" aria-label="Kirim pesan"
          className={"h-9 w-9 shrink-0 flex items-center justify-center rounded-full transition-all mb-0.5 " + (canSend ? "cursor-pointer active:scale-95" : "cursor-not-allowed")}
          style={canSend ? { background: "var(--cp-send-bg)", color: "var(--cp-send-text)" } : { background: "transparent", color: "var(--cp-subtle)" }}>
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <ArrowUp size={14} strokeWidth={2.5} />}
        </button>
      </div>
    </div>
  );
}

// ─── Message bubble ──────────────────────────────────────────────────────────
function MessageBubble({ message, idx, onCopy, copiedIdx }) {
  const isUser = message.role === "user";
  return (
    <div data-testid={"copilot-ws-msg-" + message.role + "-" + idx}
      className={"flex w-full flex-col " + (isUser ? "items-end" : "items-start")}>
      {isUser ? (
        <div className="max-w-[82%] break-words rounded-2xl border px-3.5 py-2.5 text-[13px] leading-[1.65]"
          style={{ background: "var(--cp-surface-2)", borderColor: "var(--cp-border)", color: "var(--cp-text)" }}>
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      ) : (
        <div className="w-full min-w-0 group">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10.5px] font-semibold font-gemini-mono uppercase tracking-[0.12em]"
              style={{ color: "var(--cp-muted)" }}>Copilot</span>
            <div className="flex items-center gap-2">
              {message.timestamp && (
                <span className="hidden sm:inline text-[10px] font-gemini-mono" style={{ color: "var(--cp-subtle)" }}>
                  {message.timestamp}
                </span>
              )}
              <button onClick={() => onCopy(message.content, idx)}
                data-testid={"copilot-ws-copy-" + idx} title="Salin" aria-label="Salin respons"
                className="opacity-0 group-hover:opacity-100 p-1 rounded cursor-pointer transition-all"
                style={{ color: "var(--cp-muted)" }}>
                {copiedIdx === idx ? <Check size={12} style={{ color: "var(--cp-text)" }} /> : <Copy size={12} />}
              </button>
            </div>
          </div>
          {message.isError ? (
            <div className="flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[13px]"
              style={{ borderColor: "rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.07)", color: "#fca5a5" }}>
              <AlertCircle size={14} className="shrink-0 mt-0.5" /><span>{message.content}</span>
            </div>
          ) : (
            <div className="min-w-0"><CopilotMarkdown content={message.content} /></div>
          )}
          {message.needsAuth && (
            <div className="mt-3 flex items-center gap-2.5 rounded-lg border px-3 py-2"
              style={{ borderColor: "var(--cp-border)", background: "var(--cp-surface-2)" }}>
              <span className="text-[11px]" style={{ color: "var(--cp-muted)" }}>Masuk untuk melanjutkan.</span>
              <Link to="/login?next=/app/copilot" data-testid="copilot-ws-cta-login"
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold shrink-0 transition-colors"
                style={{ background: "var(--cp-send-bg)", color: "var(--cp-send-text)" }}>
                Masuk <ArrowUpRight size={10} />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Utility bar — workspace-specific controls only ──────────────────────────
function UtilityBar({ onContextOpen, user, contextAvailable }) {
  return (
    <div className="shrink-0 flex items-center justify-end h-9 px-3 gap-1 border-b"
      style={{ background: "var(--cp-rail)", borderColor: "var(--cp-border)" }}>
      <span className="hidden lg:flex items-center gap-1.5 mr-auto text-[10px] font-bold uppercase tracking-[0.16em] font-gemini-mono"
        style={{ color: "var(--cp-muted)" }}>
        Copilot <span style={{ color: "var(--cp-subtle)" }}>·</span> Workspace
      </span>
      {contextAvailable && <button onClick={onContextOpen} data-testid="copilot-ws-context-toggle-desktop"
        className="xl:hidden h-7 px-2.5 flex items-center gap-1.5 rounded-lg border text-[10.5px] font-medium cursor-pointer transition-colors"
        style={{ background: "var(--cp-badge)", borderColor: "var(--cp-border)", color: "var(--cp-badge-text)" }}
        aria-label="Context inspector">
        Context
      </button>}
      {!user && (
        <Link to="/login?next=/app/copilot" data-testid="copilot-ws-login-cta"
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-colors shrink-0"
          style={{ background: "var(--cp-send-bg)", color: "var(--cp-send-text)" }}>
          <LogIn size={11} /> Masuk
        </Link>
      )}
    </div>
  );
}

// ─── Empty state — INTENTIONALLY MINIMAL ─────────────────────────────────────
// ─── Main workspace ───────────────────────────────────────────────────────────
export default function CopilotWorkspace({
  mode,
  messages,
  input,
  onInputChange,
  loading,
  onSend,
  activeResult,
  errorMessage,
  onClearChat,
  user,
}) {
  const [navOpen, setNavOpen]         = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedIdx, setCopiedIdx]     = useState(null);
  const [activeWorkflow, setActiveWorkflow] = useState(null);
  const threadRef = useRef(null);

  // Scroll to bottom on new messages / loading state change
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }, [messages, loading]);

  const handleNewChat = useCallback(() => {
    onClearChat();
    setActiveWorkflow(null);
    onInputChange("");
    setContextOpen(false);
    setNavOpen(false);
  }, [onClearChat, onInputChange]);

  const handleToolClick = useCallback((tool) => {
    if (tool.behavior !== "COPILOT_WORKFLOW") return;
    setActiveWorkflow(tool);
    onInputChange(tool.starter || "");
    setTimeout(() => {
      document.querySelector("[data-testid='copilot-ws-input']")?.focus();
    }, 50);
  }, [onInputChange]);

  const handleCopy = useCallback((text, idx) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }, []);

  const contextItems = getContextItems(activeResult);
  const contextAvailable = contextItems.length > 0;

  return (
    <div
      data-testid="copilot-workspace"
      data-copilot-theme="dark"
      className="flex flex-col h-full overflow-hidden font-gemini"
      style={{ background: "var(--cp-bg)", color: "var(--cp-text)" }}>

      {/* Utility bar */}
      <UtilityBar
        onContextOpen={() => setContextOpen(true)}
        user={user}
        contextAvailable={contextAvailable}
      />

      {/* Workspace body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Left sidebar — desktop ≥1024px */}
        <aside className="hidden lg:flex flex-col w-56 shrink-0 h-full border-r overflow-hidden"
          style={{ background: "var(--cp-rail)", borderColor: "var(--cp-border)" }}>
          <NavContent mode={mode} activeWorkflow={activeWorkflow?.id} onToolClick={handleToolClick} onNewChat={handleNewChat}
            searchQuery={searchQuery} onSearchChange={setSearchQuery} onClose={null} />
        </aside>

        {/* Center column */}
        <div className="flex flex-col flex-1 min-h-0 min-w-0">
          {/* Conversation thread */}
          <div ref={threadRef} role="log" aria-live="polite" aria-label="Percakapan Okkax Copilot"
            className="flex-1 overflow-y-auto overflow-x-hidden cp-scroll px-4 py-4"
            style={{ background: "var(--cp-bg)" }}>
            <div className="mx-auto w-full max-w-2xl space-y-5 min-h-full">
              {messages.map((msg, idx) => (
                <MessageBubble key={idx} message={msg} idx={idx} onCopy={handleCopy} copiedIdx={copiedIdx} />
              ))}
              {loading && (
                <div className="flex items-center gap-2" data-testid="copilot-ws-loading">
                  <span className="text-[11px] font-gemini-mono animate-pulse" style={{ color: "var(--cp-muted)" }}>
                    Memproses…
                  </span>
                </div>
              )}
              {errorMessage && !loading && (
                <div className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[12px]"
                  style={{ borderColor: "rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.07)", color: "#fca5a5" }}
                  data-testid="copilot-ws-error">
                  <AlertCircle size={13} className="shrink-0" />{errorMessage}
                </div>
              )}
            </div>
          </div>

          {/* Composer */}
          <ComposerBar
            input={input} onInputChange={onInputChange} onSend={onSend} loading={loading}
            onNavOpen={() => setNavOpen(true)} onContextOpen={() => setContextOpen(true)}
            onClearWorkflow={() => { setActiveWorkflow(null); onInputChange(""); }}
            activeWorkflow={activeWorkflow}
            contextAvailable={contextAvailable}
          />
        </div>

        {/* Right context inspector — only after meaningful data exists */}
        {contextAvailable && <aside className="hidden xl:flex flex-col w-60 shrink-0 border-l"
          style={{ background: "var(--cp-rail)", borderColor: "var(--cp-border)" }}>
          <ContextPanel activeResult={activeResult} />
        </aside>}
      </div>

      {/* Mobile: nav drawer (left) */}
      <NavDrawer isOpen={navOpen} onClose={() => setNavOpen(false)}>
        <NavContent mode={mode} activeWorkflow={activeWorkflow?.id} onToolClick={handleToolClick} onNewChat={handleNewChat}
          searchQuery={searchQuery} onSearchChange={setSearchQuery} onClose={() => setNavOpen(false)} />
      </NavDrawer>

      {/* Mobile: context bottom sheet */}
      {contextAvailable && <BottomDrawer isOpen={contextOpen} onClose={() => setContextOpen(false)} title="Context Inspector">
        <div style={{ minHeight: "50dvh" }}>
          <ContextPanel activeResult={activeResult} />
        </div>
      </BottomDrawer>}
    </div>
  );
}
