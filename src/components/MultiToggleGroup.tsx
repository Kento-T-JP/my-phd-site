import React from "react";

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
}

export default function MultiToggleGroup({
  legend,
  options,
  selectedValues,
  onChange,
  emptyLabel = "候補がありません",
  className = "",
}: Props) {
  const selectedSet = new Set(selectedValues);

  const toggle = (value: string) => {
    const next = selectedSet.has(value)
      ? selectedValues.filter((v) => v !== value)
      : [...selectedValues, value];
    onChange(next);
  };

  return (
    <fieldset className={`rounded-xl border border-sky-200/30 bg-slate-900/35 p-2.5 ${className}`}>
      <legend className="px-1 text-xs font-semibold tracking-wide text-cyan-100">
        {legend}
      </legend>
      <div className="mb-2 flex items-center justify-end gap-2">
        <button
          type="button"
          className="rounded-md border border-slate-500/70 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700/45"
          onClick={() => onChange([])}
          disabled={selectedValues.length === 0}
        >
          Clear
        </button>
      </div>
      <div className="flex max-h-36 flex-wrap gap-1.5 overflow-auto pr-1">
        {options.length === 0 ? (
          <span className="text-xs text-slate-300/80">{emptyLabel}</span>
        ) : (
          options.map((opt) => {
            const selected = selectedSet.has(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                className={`rounded-full border px-2.5 py-1 text-xs transition ${
                  selected
                    ? "border-cyan-200 bg-cyan-300 text-slate-950 shadow-[0_0_0_1px_rgba(160,230,255,0.35)]"
                    : "border-slate-500/70 bg-slate-800/50 text-slate-100 hover:border-cyan-200/60 hover:bg-slate-700/70"
                }`}
                onClick={() => toggle(opt.value)}
                aria-pressed={selected}
              >
                {opt.label}
              </button>
            );
          })
        )}
      </div>
    </fieldset>
  );
}
