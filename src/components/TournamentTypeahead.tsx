"use client";

import { useState, useEffect } from "react";

export interface TournamentOption {
  id: number;
  name: string;
  slug: string;
}

interface Props {
  value: string;
  onChange: (name: string, slug?: string) => void;
  listId?: string;
  placeholder?: string;
}

export default function TournamentTypeahead({ value, onChange, listId = "tournament-list", placeholder }: Props) {
  const [options, setOptions] = useState<TournamentOption[]>([]);

  useEffect(() => {
    fetch("/api/tournaments")
      .then((res) => (res.ok ? res.json() : []))
      .then((d) => setOptions(d))
      .catch(() => {});
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const match = options.find((o) => o.name === val);
    onChange(val, match?.slug);
  };

  const filtered = value
    ? options.filter((o) => o.name.toLowerCase().includes(value.toLowerCase()))
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
          <option key={o.id} value={o.name} />
        ))}
      </datalist>
    </>
  );
}
