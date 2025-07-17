import '@testing-library/jest-dom/vitest';
import React from 'react';
import { vi } from 'vitest';

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => React.createElement('img', props),
}));

vi.mock('next/link', () => ({
  __esModule: true,
  default: (props: any) => React.createElement('a', props),
}));
