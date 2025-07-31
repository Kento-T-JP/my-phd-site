import React from 'react';

export interface TooltipProps {
  /** element that triggers the tooltip */
  children: React.ReactNode;
  /** tooltip content */
  content: React.ReactNode;
  className?: string;
}

/** Simple tooltip that appears on hover or focus */
export default function Tooltip({ children, content, className = '' }: TooltipProps) {
  return (
    <span className={`relative group ${className}`.trim()}>
      {children}
      <span className="pointer-events-none whitespace-nowrap absolute z-10 -top-8 left-1/2 -translate-x-1/2 px-2 py-1 text-xs rounded bg-gray-800 text-white opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">
        {content}
      </span>
    </span>
  );
}
