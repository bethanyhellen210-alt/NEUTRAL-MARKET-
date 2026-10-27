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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (password.length < 12 || password.length > 128) {
      return Response.json({ error: "Use a password between 12 and 128 characters." }, { status: 400 });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [email, passwordHash]
    );
    await query("INSERT INTO trading_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING", [result.rows[0].id]);
    const session = await createSession(result.rows[0].id);
    return Response.json({ user: result.rows[0], message: "Account created. Choose a subscription before enabling trading." }, {
      status: 201,
      headers: { "Set-Cookie": sessionCookie(session.token, session.expiresAt), "Cache-Control": "no-store" }
    });
  } catch (error) {
    if (error?.code === "23505") return Response.json({ error: "An account with this email already exists." }, { status: 409 });
    return Response.json({ error: "Registration failed. Check server database configuration." }, { status: 500 });
  }
}
