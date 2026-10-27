import MetaApi from "metaapi.cloud-sdk/esm-node";
import { query } from "../../../../lib/db.js";
import { requireUser, requireSubscription, authError } from "../../../../lib/user-auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!process.env.METAAPI_TOKEN) return Response.json({ error: "METAAPI_TOKEN is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    const user = await requireUser();
    await requireSubscription(user.id);
    const linked = await query(
      "SELECT id, metaapi_account_id, broker_server, account_mode, status, created_at FROM broker_accounts WHERE user_id = $1 AND status <> 'revoked' ORDER BY created_at DESC LIMIT 1",
      [user.id]
    );
    if (!linked.rows[0]) return Response.json({ connected: false, account: null }, { headers: { "Cache-Control": "no-store" } });
    const linkedAccount = linked.rows[0];
    const api = new MetaApi(process.env.METAAPI_TOKEN);
    const account = await api.metatraderAccountApi.getAccount(linkedAccount.metaapi_account_id);
    const connected = account.state === "DEPLOYED" && account.connectionStatus === "CONNECTED";
    let summary = null;
    if (connected) {
      const connection = account.getRPCConnection();
      await connection.connect();
      await connection.waitSynchronized();
      const [information, positions] = await Promise.all([connection.getAccountInformation(), connection.getPositions()]);
      summary = {
        balance: information.balance,
        equity: information.equity,
        currency: information.currency,
        margin: information.margin,
        freeMargin: information.freeMargin,
        openPositions: positions.length,
        positions: positions.map(p => ({ id: p.id, symbol: p.symbol, type: p.type, volume: p.volume, openPrice: p.openPrice, currentPrice: p.currentPrice, profit: p.profit, stopLoss: p.stopLoss, takeProfit: p.takeProfit }))
      };
    }
    await query("UPDATE broker_accounts SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3", [connected ? "connected" : "disconnected", linkedAccount.id, user.id]);
    return Response.json({
      connected,
      account: { id: linkedAccount.id, server: linkedAccount.broker_server, mode: linkedAccount.account_mode, state: account.state, connectionStatus: account.connectionStatus },
      summary
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof TypeError && !process.env.METAAPI_TOKEN) return Response.json({ error: "METAAPI_TOKEN is not configured." }, { status: 503 });
    return authError(error);
  }
}
