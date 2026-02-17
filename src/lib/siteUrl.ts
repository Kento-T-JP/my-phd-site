export function getSiteUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXTAUTH_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ];
  const resolved = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
  return (resolved ?? 'https://example.com').replace(/\/+$/, '');
}
