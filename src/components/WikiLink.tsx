import React from 'react';
import Image from 'next/image';

export interface WikiLinkProps {
  name: string;
  lang?: 'ja' | 'en';
  variant?: 'chip' | 'button' | 'icon';
  className?: string;
  wikiUrl?: string;
}

/** Link to the player's Wikipedia page */
export default function WikiLink({
  name,
  lang = 'ja',
  variant = 'chip',
  className = '',
  wikiUrl,
}: WikiLinkProps) {
  const sanitizedName = name.replace(/[_\s]/g, '');
  const href =
    wikiUrl ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(sanitizedName)}`;

  if (variant === 'icon') {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open ${name} on Wikipedia`}
        className={`inline-block cursor-pointer w-4 h-4 ${className}`.trim()}
      >
        <Image
          src="/wikipedia.svg"
          alt="Wikipedia logo"
          width={16}
          height={16}
          className="w-4 h-4"
        />
      </a>
    );
  }

  const base =
    'relative group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400';
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
      aria-label={`Open ${name} on Wikipedia`}
      className={classes}
    >
      Wikipedia
    </a>
  );
}