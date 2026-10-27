export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SECURITY GATE:
// This endpoint must not return broker balances or positions until real user
// authentication, account ownership checks, and authorization are implemented.
// Do not remove this gate merely to make the dashboard display account data.

export async function GET() {
  return Response.json({
    connected: false,
    error: "Broker account data is locked until authenticated user sessions and account ownership checks are implemented.",
    liveTradingEnabled: false
  }, {
    status: 423,
    headers: { "Cache-Control": "no-store" }
  });
}
