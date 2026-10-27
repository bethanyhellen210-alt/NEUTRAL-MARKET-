import { createHmac, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = "nexusfx_admin";
const MAX_AGE_SECONDS = 12 * 60 * 60;

function sign(timestamp, secret) {
  return createHmac("sha256", secret).update(timestamp).digest("hex");
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

function validSession(request, secret) {
  const raw = request.cookies.get(COOKIE)?.value;
  if (!raw) return false;
  const [timestamp, signature, extra] = raw.split(".");
  if (!timestamp || !signature || extra) return false;
  const issued = Number(timestamp);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(issued) || issued > now || now - issued > MAX_AGE_SECONDS) return false;
  return safeEqual(signature, sign(timestamp, secret));
}

function cookie(value, maxAge) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${maxAge}${secure}`;
}

export async function GET(request) {
  const secret = process.env.NEXUSFX_ADMIN_SECRET;
  if (!secret) {
    return Response.json({ authenticated: false, error: "NEXUSFX_ADMIN_SECRET is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({ authenticated: validSession(request, secret) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request) {
  const secret = process.env.NEXUSFX_ADMIN_SECRET;
  if (!secret) {
    return Response.json({ authenticated: false, error: "Set NEXUSFX_ADMIN_SECRET in Vercel Environment Variables first." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ authenticated: false, error: "Invalid request body." }, { status: 400 });
  }
  if (typeof body?.secret !== "string" || !safeEqual(body.secret, secret)) {
    return Response.json({ authenticated: false, error: "Incorrect admin secret." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const timestamp = String(Math.floor(Date.now() / 1000));
  const value = `${timestamp}.${sign(timestamp, secret)}`;
  return Response.json({ authenticated: true, message: "Admin session created." }, {
    headers: { "Set-Cookie": cookie(value, MAX_AGE_SECONDS), "Cache-Control": "no-store" }
  });
}

export async function DELETE() {
  return Response.json({ authenticated: false }, {
    headers: { "Set-Cookie": cookie("", 0), "Cache-Control": "no-store" }
  });
}
