import { getCurrentUser } from "../../../../lib/user-auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ user: null }, { status: 401, headers: { "Cache-Control": "no-store" } });
    return Response.json({ user }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Authentication database unavailable." }, { status: 503 });
  }
}
