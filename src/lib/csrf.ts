const CSRF_COOKIE_NAMES = [
  '__Host-next-auth.csrf-token',
  '__Secure-next-auth.csrf-token',
  'next-auth.csrf-token',
] as const;

const normalizeCookieToken = (rawValue: string): string => {
  const decoded = decodeURIComponent(rawValue).trim();
  const unquoted =
    decoded.length >= 2 && decoded.startsWith('"') && decoded.endsWith('"')
      ? decoded.slice(1, -1)
      : decoded;
  return unquoted.split('|')[0]?.trim() ?? '';
};

const extractCsrfTokens = (cookieHeader: string): string[] => {
  if (!cookieHeader) return [];

  return cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .map((entry) => {
      const separatorIndex = entry.indexOf('=');
      if (separatorIndex === -1) return null;
      const name = entry.slice(0, separatorIndex).trim();
      const value = entry.slice(separatorIndex + 1);
      if (!CSRF_COOKIE_NAMES.includes(name as (typeof CSRF_COOKIE_NAMES)[number])) {
        return null;
      }
      const token = normalizeCookieToken(value);
      return token || null;
    })
    .filter((token): token is string => Boolean(token));
};

export function verifyCsrfToken(req: Request): boolean {
  const headerToken = req.headers.get('x-csrf-token')?.trim();
  if (!headerToken) return false;

  const cookieHeader = req.headers.get('cookie') ?? '';
  const cookieTokens = extractCsrfTokens(cookieHeader);
  if (cookieTokens.length === 0) return false;

  return cookieTokens.includes(headerToken);
}
