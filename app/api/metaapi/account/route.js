import MetaApi from "metaapi.cloud-sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.METAAPI_TOKEN;
  const accountId = process.env.METAAPI_ACCOUNT_ID;

  if (!token || !accountId) {
    return Response.json({ error: "MetaApi is not configured on the server." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const api = new MetaApi(token);
    const account = await api.metatraderAccountApi.getAccount(accountId);
    const state = account.state;
    const connectionStatus = account.connectionStatus;

    if (state !== "DEPLOYED" || connectionStatus !== "CONNECTED") {
      return Response.json({
        connected: false,
        state: state ?? "UNKNOWN",
        connectionStatus: connectionStatus ?? "UNKNOWN",
        message: "The MT5 account is not fully deployed and connected in MetaApi yet."
      }, { headers: { "Cache-Control": "no-store" } });
    }

    const connection = account.getRPCConnection();
    await connection.connect();
    await connection.waitSynchronized();
    const [information, positions] = await Promise.all([
      connection.getAccountInformation(),
      connection.getPositions()
    ]);

    return Response.json({
      connected: true,
      account: {
        login: information.login,
        name: information.name,
        server: information.server,
        currency: information.currency,
        balance: information.balance,
        equity: information.equity,
        margin: information.margin,
        freeMargin: information.freeMargin,
        leverage: information.leverage,
        tradeAllowed: information.tradeAllowed
      },
      positions: positions.map((p) => ({
        id: p.id,
        symbol: p.symbol,
        type: p.type,
        volume: p.volume,
        openPrice: p.openPrice,
        currentPrice: p.currentPrice,
        profit: p.profit,
        stopLoss: p.stopLoss,
        takeProfit: p.takeProfit,
        time: p.time
      })),
      trading: { liveOrderExecutionEnabled: false }
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({
      error: "MetaApi account lookup failed.",
      detail: error instanceof Error ? error.message : "Unknown MetaApi error"
    }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
