import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

// Shared dropdown untuk seluruh OKKAX. Menggantikan native <select> dan
// PremiumSelect lama karena native popup Chrome menempel di posisi trigger
// dan tidak nutup saat page di-scroll, sehingga terasa melayang aneh.
// OkxDropdown menempatkan menu absolute di dalam parent sehingga ikut scroll
// bersama layout, close saat klik luar atau Escape, dan otomatis menampilkan
// kolom pencarian bila jumlah opsi >= 10.
//
// options: array of { value: string, label: string } atau string biasa
// (string di-normalisasi menjadi { value: str, label: str }).
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
  const shellRef = useRef(null);
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

  const canSearch = searchable ?? normalized.length >= 10;
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
      // Focus kolom pencarian tanpa auto-scroll browser (menu tetap di posisi).
      searchRef.current?.focus({ preventScroll: true });
    } else {
      setQuery("");
    }
  }, [open, canSearch]);

  const handleSelect = (nextValue) => {
    onChange?.(nextValue);
    setOpen(false);
  };

  return (
    <div
      ref={shellRef}
      className={`relative ${className}`}
      data-testid={testId ? `${testId}-shell` : undefined}
    >
      <button
        type="button"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        data-testid={testId}
        className={`flex h-11 w-full items-center gap-2 border border-zinc-700 bg-[#111114] px-3 text-left text-sm text-white outline-none transition-colors hover:border-zinc-500 focus:border-[var(--okx-accent)] disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {Icon && <Icon size={15} strokeWidth={1.7} className="shrink-0 text-zinc-400" aria-hidden="true" />}
        <span className={`min-w-0 flex-1 truncate ${active ? "font-medium" : "text-zinc-500"}`}>
          {active?.label || placeholder}
        </span>
        <ChevronDown
          size={16}
          strokeWidth={1.8}
          className={`shrink-0 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 border border-zinc-700 bg-[#0d0d0f] shadow-2xl"
          data-testid={testId ? `${testId}-menu` : undefined}
        >
          {canSearch && (
            <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
              <Search size={14} className="shrink-0 text-zinc-500" aria-hidden="true" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari..."
                className="w-full bg-transparent text-xs text-zinc-100 outline-none placeholder:text-zinc-600"
                data-testid={testId ? `${testId}-search` : undefined}
              />
            </div>
          )}
          <ul className="okx-scroll max-h-64 overflow-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-xs text-zinc-500">Tidak ada hasil.</li>
            ) : (
              filtered.map((opt) => {
                const selected = String(opt.value) === String(value ?? "");
                return (
                  <li key={opt.value + opt.label}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => handleSelect(opt.value)}
                      className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/[0.04] ${
                        selected
                          ? "bg-[var(--okx-accent)]/10 text-[var(--okx-accent-soft)]"
                          : "text-zinc-300"
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {selected && (
                        <span aria-hidden="true" className="ml-3 inline-block h-1.5 w-1.5 bg-[var(--okx-accent)]" />
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
