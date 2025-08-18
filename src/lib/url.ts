import { headers } from "next/headers";

/**
 * Build the base URL for the current request.
 *
 * Next.js 15's `headers()` returns a `Headers` wrapped in a `Promise`,
 * so we need to await it before accessing header values.
 */
export async function getBaseUrl() {
  const headersList = await headers();
  const protocol =
    headersList.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "development" ? "http" : "https");
  const host =
    headersList.get("x-forwarded-host") ??
    headersList.get("host") ??
    "localhost:3000";
  return `${protocol}://${host}`;
}
