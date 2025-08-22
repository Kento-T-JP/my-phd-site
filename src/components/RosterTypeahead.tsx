"use client";

import React, { useState, useEffect } from "react";
import { rosterDisplayTitle } from "@/lib/format";
import type { RosterSummary } from "@/types/roster";

export interface RosterOption {
  id: number;
  title: string;
}

interface Props {
  slug?: string;
  value: string;
  onChange: (title: string) => void;
  listId?: string;
  placeholder?: string;
}

export default function RosterTypeahead({ slug, value, onChange, listId = "roster-list", placeholder }: Props) {
  const [options, setOptions] = useState<RosterOption[]>([]);

  useEffect(() => {
    if (!slug) return setOptions([]);
    const controller = new AbortController();
    fetch(`/api/rosters?slug=${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then((res) =>
        res.ok
          ? (res.json() as Promise<RosterSummary[]>)
          : ([] as RosterSummary[])
      )
      .then((d: RosterSummary[]) =>
        setOptions(
          d.map<RosterOption>((r: RosterSummary) => ({
            id: r.id,
            title: rosterDisplayTitle(r),
          }))
        )
      )
      .catch(() => {});
    return () => controller.abort();
  }, [slug]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const filtered = value
    ? options.filter((o) => o.title.toLowerCase().includes(value.toLowerCase()))
    : options;

  return (
    <>
      <input
        list={listId}
        className="w-full p-2 border rounded"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
      />
      <datalist id={listId}>
        {filtered.map((o) => (
          <option key={o.id} value={o.title} />
        ))}
      </datalist>
    </>
  );
}
