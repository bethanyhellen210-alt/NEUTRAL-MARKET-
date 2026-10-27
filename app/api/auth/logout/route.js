import { cookies } from "next/headers";
import { query } from "../../../../lib/db.js";
import { hashToken, USER_COOKIE } from "../../../../lib/user-auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const jar = await cookies();
    const token = jar.get(USER_COOKIE)?.value;
    if (token) await query("DELETE FROM user_sessions WHERE token_hash = $1", [hashToken(token)]);
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    return Response.json({ ok: true }, {
      headers: { "Set-Cookie": `${USER_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`, "Cache-Control": "no-store" }
    });
  } catch {
    return Response.json({ error: "Logout failed." }, { status: 500 });
  }
}
