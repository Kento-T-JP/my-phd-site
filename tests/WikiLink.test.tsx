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
});
