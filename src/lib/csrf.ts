export function verifyCsrfToken(req: Request): boolean {
  const headerToken = req.headers.get('x-csrf-token');
  if (!headerToken) return false;
  const cookieHeader = req.headers.get('cookie') ?? '';
  const match = cookieHeader.match(/next-auth\.csrf-token=([^;]+)/);
  if (!match) return false;
  const cookieToken = decodeURIComponent(match[1]).split('|')[0];
  return cookieToken === headerToken;
}
