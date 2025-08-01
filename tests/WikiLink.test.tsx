import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import WikiLink from '@/components/WikiLink';
import { describe, it, expect, afterEach } from 'vitest';

describe('WikiLink', () => {
  afterEach(() => cleanup());
  it('renders chip variant with correct href and attributes', () => {
    render(<WikiLink name="JohnDoe" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://ja.wikipedia.org/wiki/JohnDoe');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText('Open JohnDoe on Wikipedia')).toBeInTheDocument();
  });

  it('supports english and button variant', () => {
    render(<WikiLink name="JaneDoe" lang="en" variant="button" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/JaneDoe');
    expect(link.className).toMatch(/w-full/);
  });

  it('renders icon variant with tooltip text', () => {
    render(<WikiLink name="IconUser" variant="icon" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://ja.wikipedia.org/wiki/IconUser');
    expect(screen.getByText('View on Wikipedia →')).toBeInTheDocument();
  });

  it('sanitizes and encodes multibyte names correctly', () => {
    render(<WikiLink name="鈴木 彩艶" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute(
      'href',
      'https://ja.wikipedia.org/wiki/%E9%88%B4%E6%9C%A8%E5%BD%A9%E8%89%B6'
    );
  });

  it('uses custom wikiUrl when provided', () => {
    render(<WikiLink name="Foo" wikiUrl="https://example.com" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://example.com');
  });
});
