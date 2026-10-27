import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { query } from "./db.js";

export const USER_COOKIE = "nexusfx_session";

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function createToken() {
  return randomBytes(32).toString("base64url");
}

export async function createSession(userId) {
  const token = createToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  await query(
    "INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [userId, hashToken(token), expiresAt]
  );
  return { token, expiresAt };
}

export function sessionCookie(token, expiresAt) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${USER_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Expires=${expiresAt.toUTCString()}${secure}`;
}

export async function getCurrentUser() {
  const jar = await cookies();
  const token = jar.get(USER_COOKIE)?.value;
  if (!token || token.length > 200) return null;
  const result = await query(
    `SELECT u.id, u.email, u.created_at
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > NOW()
      LIMIT 1`,
    [hashToken(token)]
  );
  return result.rows[0] || null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    const error = new Error("Sign in is required.");
    error.status = 401;
    throw error;
  }
  return user;
}

export async function requireSubscription(userId) {
  const result = await query(
    `SELECT plan, expires_at FROM subscriptions
      WHERE user_id = $1 AND status = 'active' AND expires_at > NOW()
      ORDER BY expires_at DESC LIMIT 1`,
    [userId]
  );
  if (!result.rows[0]) {
    const error = new Error("An active, verified subscription is required.");
    error.status = 402;
    throw error;
  }
  return result.rows[0];
}

export function authError(error) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  return Response.json(
    { error: status === 500 ? "Request could not be completed." : error.message },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}
