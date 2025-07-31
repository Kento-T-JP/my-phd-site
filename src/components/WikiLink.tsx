import React from 'react';

export interface WikiLinkProps {
  name: string;
  lang?: 'ja' | 'en';
  variant?: 'chip' | 'button';
  className?: string;
}

/** Link to the player's Wikipedia page */
export default function WikiLink({
  name,
  lang = 'ja',
  variant = 'chip',
  className = '',
}: WikiLinkProps) {
  const href = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(name.trim())}`;
  const base =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400';
  const chip =
    'inline-block px-2 py-0.5 border border-cyan-300 text-cyan-300 text-xs rounded';
  const button =
    'block w-full text-center px-4 py-2 min-h-[44px] border border-cyan-300 text-cyan-300 rounded';
  const classes = `${base} ${variant === 'button' ? button : chip} ${className}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${name} on Wikipedia (new tab)`}
      title={`Open ${name} on Wikipedia (new tab)`}
      className={classes}
    >
      Wikipedia
    </a>
  );
}
