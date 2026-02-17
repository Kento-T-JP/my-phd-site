import { revalidateTag, unstable_cache } from 'next/cache';

export async function runWithCache<T>(
  callback: () => Promise<T>,
  keyParts: string[],
  options: { revalidate: number; tags: string[] },
): Promise<T> {
  if (process.env.NODE_ENV === 'test') {
    return callback();
  }
  return unstable_cache(callback, keyParts, options)();
}

export function revalidateTagSafe(tag: string): void {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  revalidateTag(tag, 'max');
}

