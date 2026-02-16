export function verifyCsrfToken(req: Request): boolean {
  const headerToken = req.headers.get('x-csrf-token');
  if (!headerToken) return false;
  const cookieHeader = req.headers.get('cookie') ?? '';
  if (!cookieHeader) return false;
  const cookieTokens = cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const eq = entry.indexOf('=');
      if (eq === -1) return null;
      const name = entry.slice(0, eq).trim();
      const value = entry.slice(eq + 1).trim();
      if (!name.endsWith('next-auth.csrf-token')) return null;
      const decoded = decodeURIComponent(value).replace(/^"|"$/g, '');
      return decoded.split('|')[0];
    })
    .filter((token): token is string => Boolean(token));
  return cookieTokens.some((token) => token === headerToken);
}
