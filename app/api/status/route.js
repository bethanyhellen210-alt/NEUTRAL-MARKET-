import MetaApi from "metaapi.cloud-sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.METAAPI_TOKEN;
  const accountId = process.env.METAAPI_ACCOUNT_ID;
  if (!token || !accountId) {
    return Response.json({
      app: "NexusFX",
      status: "configuration_required",
      metaApiConfigured: false,
      brokerConnected: false,
      liveTradingEnabled: false,
      message: "Set METAAPI_TOKEN and METAAPI_ACCOUNT_ID in the server environment."
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const api = new MetaApi(token);
    const account = await api.metatraderAccountApi.getAccount(accountId);
    const connected = account.state === "DEPLOYED" && account.connectionStatus === "CONNECTED";
    return Response.json({
      app: "NexusFX",
      status: connected ? "connected" : "not_connected",
      metaApiConfigured: true,
      brokerConnected: connected,
      accountState: account.state ?? "UNKNOWN",
      connectionStatus: account.connectionStatus ?? "UNKNOWN",
      liveTradingEnabled: false,
      message: connected
        ? "MetaApi reports the configured MT5 account as deployed and connected. User authentication and account ownership are still required before private account data or trading can be enabled."
        : "MetaApi credentials are configured, but the MT5 account is not deployed and connected."
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({
      app: "NexusFX",
      status: "connection_error",
      metaApiConfigured: true,
      brokerConnected: false,
      liveTradingEnabled: false,
      message: "MetaApi could not verify the configured account.",
      detail: error instanceof Error ? error.message : "Unknown MetaApi error"
    }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
