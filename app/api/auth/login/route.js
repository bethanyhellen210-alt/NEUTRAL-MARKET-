import bcrypt from "bcryptjs";
import { query } from "../../../../lib/db.js";
import { createSession, sessionCookie } from "../../../../lib/user-auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    if (!email || !password || email.length > 254 || password.length > 128) {
      return Response.json({ error: "Invalid email or password." }, { status: 400 });
    }
    const result = await query("SELECT id, email, password_hash FROM users WHERE email = $1 LIMIT 1", [email]);
    if (!result.rows[0] || !(await bcrypt.compare(password, result.rows[0].password_hash))) {
      return Response.json({ error: "Invalid email or password." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    const session = await createSession(result.rows[0].id);
    return Response.json({ user: { id: result.rows[0].id, email: result.rows[0].email } }, {
      headers: { "Set-Cookie": sessionCookie(session.token, session.expiresAt), "Cache-Control": "no-store" }
    });
  } catch {
    return Response.json({ error: "Login service unavailable. Check database configuration." }, { status: 500 });
  }
}
