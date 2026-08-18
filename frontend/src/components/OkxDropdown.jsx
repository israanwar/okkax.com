import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

// Shared dropdown untuk seluruh OKKAX.
// Menempatkan menu absolute di dalam parent sehingga ikut scroll
// bersama layout, close saat klik luar atau Escape, dan otomatis menampilkan
// kolom pencarian bila jumlah opsi >= 10.
export default function OkxDropdown({
  value,
  onChange,
  options = [],
  placeholder = "Pilih",
  icon: Icon,
  searchable,
  disabled = false,
  className = "",
  testId,
  ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [flipUp, setFlipUp] = useState(false);
  const shellRef = useRef(null);
  const triggerRef = useRef(null);
  const searchRef = useRef(null);

  // Normalisasi options: string -> { value, label }.
  const normalized = useMemo(
    () =>
      (options || []).map((opt) =>
        typeof opt === "string" || typeof opt === "number"
          ? { value: String(opt), label: String(opt) }
          : opt
      ),
    [options]
  );

  // Default searchable to false unless explicitly set to true.
  const canSearch = Boolean(searchable);
  const filtered = useMemo(() => {
    if (!canSearch || !query.trim()) return normalized;
    const needle = query.trim().toLowerCase();
    return normalized.filter((opt) => opt.label.toLowerCase().includes(needle));
  }, [canSearch, normalized, query]);

  const active = normalized.find((opt) => String(opt.value) === String(value ?? ""));

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event) => {
      if (!shellRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    if (open && canSearch) {
      searchRef.current?.focus({ preventScroll: true });
    } else {
      setQuery("");
    }
  }, [open, canSearch]);

  useEffect(() => {
    if (!open) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const estimated = Math.min(320, (canSearch ? 48 : 0) + normalized.length * 40 + 16);
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    setFlipUp(spaceBelow < estimated && spaceAbove > spaceBelow);
  }, [open, canSearch, normalized.length]);

  const handleSelect = (nextValue, option) => {
    if (option?.disabled) return;
    onChange?.(nextValue);
    setOpen(false);
  };

  return (
    <div
      ref={shellRef}
      className={`relative font-gemini ${className}`}
      data-testid={testId ? `${testId}-shell` : undefined}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        data-testid={testId}
        className={`flex h-11 w-full items-center gap-2 rounded-xl border border-white/[0.12] bg-[#0d0d14] px-3.5 text-left text-sm text-white outline-none transition-all duration-200 hover:border-white/25 focus:border-white/40 focus:ring-1 focus:ring-white/20 disabled:cursor-not-allowed disabled:opacity-50 ${
          open ? "border-white/40 ring-1 ring-white/20 shadow-[0_0_16px_rgba(255,255,255,0.08)] bg-[#12121e]" : ""
        }`}
      >
        {Icon && <Icon size={15} strokeWidth={1.7} className="shrink-0 text-zinc-400" aria-hidden="true" />}
        <span className={`min-w-0 flex-1 truncate ${active ? "font-semibold text-white" : "text-zinc-400"}`}>
          {active?.label || placeholder}
        </span>
        <ChevronDown
          size={16}
          strokeWidth={1.8}
          className={`shrink-0 text-zinc-400 transition-transform duration-200 ${open ? "rotate-180 text-white" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute left-0 right-0 z-50 rounded-2xl border border-white/[0.18] ring-1 ring-white/[0.08] bg-[#12121c]/98 p-2 shadow-[0_24px_60px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-3xl ${
            flipUp ? "bottom-full mb-1.5" : "top-full mt-1.5"
          }`}
          data-testid={testId ? `${testId}-menu` : undefined}
        >
          {canSearch && (
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-black/50 px-3 py-2 mb-1.5">
              <Search size={14} className="shrink-0 text-zinc-400" aria-hidden="true" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari opsi..."
                className="w-full bg-transparent text-xs text-white outline-none placeholder:text-zinc-500 font-gemini"
                data-testid={testId ? `${testId}-search` : undefined}
              />
            </div>
          )}
          <ul className="okx-custom-scrollbar max-h-60 overflow-y-auto space-y-1 pr-0.5">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-center text-xs text-zinc-400">Tidak ada opsi ditemukan.</li>
            ) : (
              filtered.map((opt) => {
                const selected = String(opt.value) === String(value ?? "");
                return (
                  <li key={opt.value + opt.label}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      aria-disabled={opt.disabled || undefined}
                      disabled={opt.disabled}
                      onClick={() => handleSelect(opt.value, opt)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-xs sm:text-sm font-medium transition-all duration-150 cursor-pointer ${
                        opt.disabled
                          ? "cursor-not-allowed text-zinc-600 opacity-50"
                          : selected
                            ? "border border-white/30 bg-white/[0.12] text-white font-bold shadow-sm"
                            : "border border-transparent text-zinc-200 hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white"
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>

                      {selected && (
                        <Check
                          size={14}
                          strokeWidth={2.5}
                          className="shrink-0 text-emerald-400"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
