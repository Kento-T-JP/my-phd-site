"use client";

import { useState, useEffect, useCallback } from "react";

export interface TournamentOption {
  id: number;
  name: string;
  slug: string;
}

interface Props {
  value: string;
  onChange: (name: string) => void;
  listId?: string;
  placeholder?: string;
}

export default function TournamentSelect({ value, onChange, listId = "tournament-list", placeholder }: Props) {
  const [options, setOptions] = useState<TournamentOption[]>([]);

  const fetchOptions = useCallback(() => {
    fetch("/api/tournaments")
      .then((res) => (res.ok ? res.json() : []))
      .then((d) => setOptions(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchOptions();
    const handler = () => fetchOptions();
    window.addEventListener("tournament-saved", handler);
    return () => {
      window.removeEventListener("tournament-saved", handler);
    };
  }, [fetchOptions]);

  const handleFocus = () => {
    fetchOptions();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
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
        onFocus={handleFocus}
      />
      <datalist id={listId}>
        {filtered.map((o) => (
          <option key={o.id} value={o.name} />
        ))}
      </datalist>
    </>
  );
}
