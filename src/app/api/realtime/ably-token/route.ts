import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { resolveSessionUserId } from "@/lib/sessionUser";
import { createAblyTokenRequest } from "@/lib/ablyServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handleTokenRequest() {
  const session = (await getServerSession(authOptions)) as {
    user?: { id?: string; email?: string | null; isAdmin?: boolean };
  } | null;
  const { userId } = await resolveSessionUserId(session);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tokenRequest = await createAblyTokenRequest(`user-${userId}`);
    return Response.json(tokenRequest);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create Ably token.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return handleTokenRequest();
}

export async function POST() {
  return handleTokenRequest();
}
