export const runtime = "nodejs";

export async function GET() {
  const configured = Boolean(process.env.METAAPI_TOKEN && process.env.METAAPI_ACCOUNT_ID);
  return Response.json({
    app: "NexusFX",
    status: "scaffold",
    metaApiConfigured: configured,
    brokerData: "not_verified",
    liveTradingEnabled: false,
    message: configured
      ? "MetaApi credentials are present. Broker connectivity still needs to be tested."
      : "Add METAAPI_TOKEN and METAAPI_ACCOUNT_ID in the hosting environment to configure MetaApi."
  }, { headers: { "Cache-Control": "no-store" } });
}
