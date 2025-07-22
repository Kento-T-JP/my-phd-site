import { headers } from "next/headers";

export function getBaseUrl() {
  const host = headers().get("host") ?? "localhost:3000";
  const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
  return `${protocol}://${host}`;
}
