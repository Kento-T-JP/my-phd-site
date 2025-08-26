export function isBot(userAgent?: string): boolean {
  if (!userAgent) return false;
  const botPattern = /(bot|crawler|spider|crawling|facebookexternalhit|slurp|bingpreview|bingbot|duckduckbot|baiduspider|yandex|semrush|ahrefs|applebot|googlebot)/i;
  return botPattern.test(userAgent);
}

export default isBot;
