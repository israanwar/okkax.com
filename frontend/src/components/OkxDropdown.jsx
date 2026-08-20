import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Plus, Search } from "lucide-react";

/**
 * Shared Popover Dropdown untuk seluruh Okkax.
 *
 * Menggunakan React Portal ke document.body dengan fixed positioning:
 * 1. Terisolasi total dari parent stacking context (misal backdrop-filter / transform).
 * 2. Tidak memperbesar tinggi parent/sticky container.
 * 3. Max-height dibatasi 280–320px dengan internal scroll.
 * 4. Background 100% solid/opaque `#0c0c14` dengan z-index 99999.
 * 5. Auto flip-up jika ruang bawah viewport tidak mencukupi.
 * 6. Single-open: otomatis menutup dropdown lain saat dibuka.
 * 7. Close on outside click, select, or Escape.
 */
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
  const [placement, setPlacement] = useState({
    top: undefined,
    bottom: undefined,
    left: 0,
    width: 200,
    maxHeight: 280,
    flipUp: false,
  });

  const dropdownId = useId();
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);

  // Normalisasi options: string/number -> { value, label }
  const normalized = useMemo(
    () =>
      (options || []).map((opt) =>
        typeof opt === "string" || typeof opt === "number"
          ? { value: String(opt), label: String(opt) }
          : opt
      ),
    [options]
  );

  const canSearch = Boolean(searchable);
  const filtered = useMemo(() => {
    if (!canSearch || !query.trim()) return normalized;
    const needle = query.trim().toLowerCase();
    return normalized.filter((opt) => opt.label.toLowerCase().includes(needle));
  }, [canSearch, normalized, query]);

  const active = normalized.find((opt) => String(opt.value) === String(value ?? ""));

  // Hitung posisi fixed terhadap viewport
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Lebar dropdown mengikuti trigger dengan batas minimum
    const width = Math.max(rect.width, 160);
    // Batasi horizontal agar tidak keluar dari viewport
    const left = Math.max(8, Math.min(rect.left, viewportWidth - width - 8));

    const spaceBelow = viewportHeight - rect.bottom - 10;
    const spaceAbove = rect.top - 10;
    const estimatedHeight = Math.min(300, (canSearch ? 48 : 0) + normalized.length * 38 + 16);

    const shouldFlipUp = spaceBelow < Math.min(220, estimatedHeight) && spaceAbove > spaceBelow;

    if (shouldFlipUp) {
      const maxHeight = Math.min(300, Math.max(120, spaceAbove));
      setPlacement({
        top: undefined,
        bottom: viewportHeight - rect.top + 6,
        left,
        width,
        maxHeight,
        flipUp: true,
      });
    } else {
      const maxHeight = Math.min(300, Math.max(120, spaceBelow));
      setPlacement({
        top: rect.bottom + 6,
        bottom: undefined,
        left,
        width,
        maxHeight,
        flipUp: false,
      });
    }
  }, [canSearch, normalized.length]);

  // Update posisi saat open berubah
  useLayoutEffect(() => {
    if (open) {
      updatePosition();
    }
  }, [open, updatePosition]);

  // Single-open coordinator + scroll / resize tracking
  useEffect(() => {
    if (!open) return;

    // Tutup jika dropdown lain dibuka
    const handleOtherOpen = (event) => {
      if (event.detail !== dropdownId) {
        setOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    const handleOutsideClick = (event) => {
      if (
        triggerRef.current?.contains(event.target) ||
        menuRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpen(false);
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    window.addEventListener("okx-dropdown-open", handleOtherOpen);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("okx-dropdown-open", handleOtherOpen);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, dropdownId, updatePosition]);

  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Focus search input on open
  useEffect(() => {
    if (open) {
      const activeIdx = filtered.findIndex((opt) => String(opt.value) === String(value ?? ""));
      setFocusedIndex(activeIdx >= 0 ? activeIdx : 0);
      if (canSearch) {
        searchRef.current?.focus({ preventScroll: true });
      }
    } else {
      setQuery("");
      setFocusedIndex(-1);
    }
  }, [open, canSearch, filtered, value]);

  // Keyboard navigation
  const handleKeyDown = (event) => {
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setOpen(true);
        window.dispatchEvent(new CustomEvent("okx-dropdown-open", { detail: dropdownId }));
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setFocusedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setFocusedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (event.key === "Home") {
      event.preventDefault();
      setFocusedIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setFocusedIndex(Math.max(0, filtered.length - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < filtered.length) {
        const item = filtered[focusedIndex];
        if (!item.disabled) {
          handleSelect(item.value, item);
        }
      }
    }
  };

  const toggleOpen = () => {
    if (disabled) return;
    if (!open) {
      updatePosition();
      window.dispatchEvent(new CustomEvent("okx-dropdown-open", { detail: dropdownId }));
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  const handleSelect = (nextValue, option) => {
    if (option?.disabled) return;
    onChange?.(nextValue);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className={`relative font-gemini ${className}`} data-testid={testId ? `${testId}-shell` : undefined}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        data-testid={testId}
        className={`flex h-8 sm:h-9 w-full items-center gap-1.5 sm:gap-2 rounded-xl border border-white/[0.12] bg-[#0d0d14] px-2.5 sm:px-3 text-left text-[11px] sm:text-xs text-white outline-none transition-all duration-200 hover:border-white/25 focus:border-white/40 focus:ring-1 focus:ring-white/20 disabled:cursor-not-allowed disabled:opacity-50 ${
          open ? "border-white/40 ring-1 ring-white/20 shadow-[0_0_16px_rgba(255,255,255,0.08)] bg-[#12121e]" : ""
        }`}
      >
        {Icon && <Icon size={14} strokeWidth={1.7} className="shrink-0 text-zinc-400" aria-hidden="true" />}
        <span className={`min-w-0 flex-1 truncate ${active ? "font-semibold text-white" : "text-zinc-400"}`}>
          {active?.label || placeholder}
        </span>
        <ChevronDown
          size={14}
          strokeWidth={1.8}
          className={`shrink-0 text-zinc-400 transition-transform duration-200 ${open ? "rotate-180 text-white" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (placement.top != null || placement.bottom != null) && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          onKeyDown={handleKeyDown}
          style={{
            position: "fixed",
            left: `${placement.left}px`,
            width: `${placement.width}px`,
            ...(placement.top != null ? { top: `${placement.top}px` } : {}),
            ...(placement.bottom != null ? { bottom: `${placement.bottom}px` } : {}),
            maxHeight: `${placement.maxHeight}px`,
            zIndex: 99999,
          }}
          className="flex flex-col rounded-xl border border-white/[0.16] bg-[#0c0c14] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.95)] animate-in fade-in zoom-in-95 duration-100 font-gemini select-none"
          data-testid={testId ? `${testId}-menu` : undefined}
        >
          {canSearch && (
            <div className="flex shrink-0 items-center gap-2 rounded-lg border border-white/[0.1] bg-black/60 px-2.5 py-1 mb-1">
              <Search size={13} className="shrink-0 text-zinc-400" aria-hidden="true" />
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
          <ul className="okx-custom-scrollbar overflow-y-auto space-y-0.5 pr-0.5 flex-1 min-h-0">
            {filtered.length === 0 ? (
              <li className="px-2.5 py-2 text-center text-xs text-zinc-400">Tidak ada opsi ditemukan.</li>
            ) : (
              filtered.map((opt, idx) => {
                const selected = String(opt.value) === String(value ?? "");
                const isFocused = idx === focusedIndex;
                const isActionItem = Boolean(opt.isAction || opt.value === "__NEW_EVENT__" || opt.label?.startsWith("+ "));
                return (
                  <li
                    key={opt.value + opt.label}
                    className={isActionItem ? "border-b border-white/[0.08] pb-1 mb-1" : ""}
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      aria-disabled={opt.disabled || undefined}
                      disabled={opt.disabled}
                      onClick={() => handleSelect(opt.value, opt)}
                      onMouseEnter={() => setFocusedIndex(idx)}
                      className={`flex w-full items-center justify-between gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-all duration-150 cursor-pointer ${
                        opt.disabled
                          ? "cursor-not-allowed text-zinc-600 opacity-50"
                          : isActionItem
                            ? selected
                              ? "border border-white/30 bg-white/[0.14] text-white font-bold"
                              : isFocused
                                ? "border border-white/20 bg-white/[0.08] text-white font-semibold"
                                : "border border-dashed border-white/20 bg-white/[0.02] text-zinc-200 hover:border-white/40 hover:bg-white/[0.06] hover:text-white font-semibold"
                            : selected
                              ? "border border-white/30 bg-white/[0.12] text-white font-bold shadow-sm"
                              : isFocused
                                ? "border border-white/20 bg-white/[0.08] text-white"
                                : "border border-transparent text-zinc-300 hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white"
                      }`}
                    >
                      <span className="truncate flex items-center gap-1.5">
                        {isActionItem && <Plus size={12} className="shrink-0 text-zinc-300" />}
                        {isActionItem ? opt.label.replace(/^\+\s*/, "") : opt.label}
                      </span>

                      {selected && (
                        <Check
                          size={13}
                          strokeWidth={2.5}
                          className="shrink-0 text-white"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>,
        document.body
      )}
    </div>
  );
}
