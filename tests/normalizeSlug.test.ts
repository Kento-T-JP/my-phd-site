import { describe, it, expect } from 'vitest';
import { normalizeSlug } from '@/lib/db';


describe('normalizeSlug', () => {
  it('generates the same slug regardless of case, spacing, or width', () => {
    const variants = [
      'Sample Cup 2024',
      'sample cup 2024',
      'SAMPLE CUP 2024',
      '  Sample   Cup 2024  ',
      'Ｓａｍｐｌｅ　Ｃｕｐ　２０２４',
    ];
    const slugs = variants.map(normalizeSlug);
    slugs.forEach((s) => expect(s).toBe(slugs[0]));
    expect(slugs[0]).toBe('sample-cup-2024');
  });
});
