import { headers } from "next/headers";

export function getBaseUrl() {
  const headersList = headers();
  const protocol = headersList.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "development" ? "http" : "https");
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "localhost:3000";
  return `${protocol}://${host}`;
}
