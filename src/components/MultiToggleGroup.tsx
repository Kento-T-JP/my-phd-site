import React, { useEffect, useMemo, useRef, useState } from "react";

type Option = {
  value: string;
  label: string;
};

interface Props {
  legend: string;
  options: Option[];
  selectedValues: string[];
  onChange: (next: string[]) => void;
  emptyLabel?: string;
  className?: string;
  wrapSelectedLabel?: boolean;
  wrapOptionLabel?: boolean;
}

export default function MultiToggleGroup({
  legend,
  options,
  selectedValues,
  onChange,
  emptyLabel = "候補がありません",
  className = "",
  wrapSelectedLabel = false,
  wrapOptionLabel = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedSet = new Set(selectedValues);
  const selectedLabel = useMemo(() => {
    if (selectedValues.length === 0) return "すべて";
    const labels = options
      .filter((opt) => selectedSet.has(opt.value))
      .map((opt) => opt.label);
    if (labels.length === 0) return "すべて";
    if (labels.length === 1) return labels[0];
    return `${labels[0]} +${labels.length - 1}`;
  }, [options, selectedSet, selectedValues.length]);

  const toggle = (value: string) => {
    const next = selectedSet.has(value)
      ? selectedValues.filter((v) => v !== value)
      : [...selectedValues, value];
    onChange(next);
  };

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (event.target instanceof Node && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <label className="mb-1 block text-xs font-semibold tracking-wide text-cyan-100">
        {legend}
      </label>
      <button
        type="button"
        className={`form-input flex min-h-10 justify-between gap-2 text-left ${
          wrapSelectedLabel ? "items-start" : "items-center"
        }`}
        aria-expanded={open}
        aria-label={`${legend} filter`}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          title={selectedLabel}
          className={`text-sm ${
            wrapSelectedLabel
              ? "whitespace-normal break-words leading-tight"
              : "truncate"
          }`}
        >
          {selectedLabel}
        </span>
        <span className="shrink-0 text-xs text-cyan-200/90">{selectedValues.length}件</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1.5 w-full rounded-xl border border-sky-200/35 bg-slate-950/95 p-2 shadow-2xl backdrop-blur">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold tracking-wide text-cyan-100">
              複数選択
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="rounded-md border border-slate-500/70 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700/45"
                onClick={() => onChange(options.map((opt) => opt.value))}
                disabled={options.length === 0 || selectedValues.length === options.length}
              >
                All
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-500/70 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700/45"
                onClick={() => onChange([])}
                disabled={selectedValues.length === 0}
              >
                Clear
              </button>
            </div>
          </div>
          <div className="max-h-56 space-y-1 overflow-auto pr-1">
            {options.length === 0 ? (
              <span className="text-xs text-slate-300/80">{emptyLabel}</span>
            ) : (
              options.map((opt) => {
                const selected = selectedSet.has(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition ${
                      selected
                        ? "bg-cyan-400/15 text-cyan-100"
                        : "text-slate-100 hover:bg-slate-800/75"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggle(opt.value)}
                    />
                    <span
                      className={
                        wrapOptionLabel
                          ? "whitespace-normal break-words leading-tight"
                          : "truncate"
                      }
                    >
                      {opt.label}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
