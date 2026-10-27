import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "nexusfx_admin";
const MAX_AGE_SECONDS = 12 * 60 * 60;

function equal(a,b) {
  const x=Buffer.from(String(a));const y=Buffer.from(String(b));
  return x.length===y.length && timingSafeEqual(x,y);
}

export function isAdminRequest(request) {
  const secret=process.env.NEXUSFX_ADMIN_SECRET;
  if(!secret)return false;
  const raw=request.cookies.get(COOKIE)?.value;
  if(!raw)return false;
  const [timestamp,signature,extra]=raw.split(".");
  if(!timestamp||!signature||extra)return false;
  const issued=Number(timestamp);const now=Math.floor(Date.now()/1000);
  if(!Number.isFinite(issued)||issued>now||now-issued>MAX_AGE_SECONDS)return false;
  const expected=createHmac("sha256",secret).update(timestamp).digest("hex");
  return equal(signature,expected);
}

export function requireAdmin(request) {
  if(!isAdminRequest(request)) {
    const error=new Error("A valid admin session is required.");
    error.status=401;
    throw error;
  }
}
