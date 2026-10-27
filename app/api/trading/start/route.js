export const runtime = "nodejs";

export async function POST() {
  return Response.json({
    accepted: false,
    tradingEnabled: false,
    error: "Order execution is intentionally disabled in this initial scaffold. Authentication, account-mode verification, strategy validation, and server-side risk limits must be implemented and tested before any order can be submitted."
  }, { status: 423, headers: { "Cache-Control": "no-store" } });
}
