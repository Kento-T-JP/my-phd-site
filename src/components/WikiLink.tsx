import React from 'react';
import Image from 'next/image';
import Tooltip from '@/components/Tooltip';

export interface WikiLinkProps {
  name: string;
  lang?: 'ja' | 'en';
  variant?: 'chip' | 'button' | 'icon';
  className?: string;
}

/** Link to the player's Wikipedia page */
export default function WikiLink({
  name,
  lang = 'ja',
  variant = 'chip',
  className = '',
}: WikiLinkProps) {
  const sanitizedName = name.replace(/[_\s]/g, '');
  const href = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(sanitizedName)}`;
  if (variant === 'icon') {
    return (
      <Tooltip content="View on Wikipedia →" className={`inline-block ${className}`.trim()}>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${name} on Wikipedia`}
          className="opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto"
        >
          <Image src="/globe.svg" alt="View on Wikipedia" width={16} height={16} />
        </a>
      </Tooltip>
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
      title={`Open ${name} on Wikipedia`}
      className={classes}
    >
      Wikipedia
      <span className="pointer-events-none whitespace-nowrap absolute z-10 -top-8 left-1/2 -translate-x-1/2 px-2 py-1 text-xs rounded bg-gray-800 text-white opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">
        {`Open ${name} on Wikipedia`}
      </span>
    </a>
  );
}
