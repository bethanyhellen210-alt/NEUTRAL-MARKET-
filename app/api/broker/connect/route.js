import { randomInt } from "node:crypto";
import MetaApi from "metaapi.cloud-sdk/esm-node";
import { query } from "../../../../lib/db.js";
import { requireUser, requireSubscription, authError } from "../../../../lib/user-auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  let createdMetaAccount = null;
  try {
    const user = await requireUser();
    await requireSubscription(user.id);
    const token = process.env.METAAPI_TOKEN;
    if (!token) return Response.json({ error: "MetaApi provisioning is not configured." }, { status: 503 });
    const body = await request.json();
    const server = String(body?.server || "").trim();
    const mode = body?.mode === "real" ? "real" : body?.mode === "demo" ? "demo" : "";
    const confirmedReal = body?.confirmRealTrading === true;
    if (!server || server.length > 120 || /[\r\n]/.test(server)) {
      return Response.json({ error: "Enter the exact MT5 broker server name." }, { status: 400 });
    }
    if (!mode) return Response.json({ error: "Choose Demo or Real account mode." }, { status: 400 });
    if (mode === "real" && !confirmedReal) {
      return Response.json({ error: "Confirm that you own this real MT5 account before linking it. Order execution remains separately disabled until platform approval." }, { status: 403 });
    }
    const existing = await query("SELECT id FROM broker_accounts WHERE user_id = $1 AND status <> 'revoked' LIMIT 1", [user.id]);
    if (existing.rowCount) return Response.json({ error: "An MT5 account is already linked. Revoke it before linking another account." }, { status: 409 });

    const api = new MetaApi(token);
    const account = await api.metatraderAccountApi.createAccount({
      name: `NexusFX subscriber ${user.id.slice(0, 8)}`,
      type: "cloud-g2",
      platform: "mt5",
      server,
      magic: randomInt(100000, 2147483647),
      quoteStreamingIntervalInSeconds: 2.5,
      reliability: "high"
    });
    createdMetaAccount = account;
    const configLink = await account.createConfigurationLink();
    await query(
      `INSERT INTO broker_accounts (user_id, metaapi_account_id, broker_server, account_mode, real_trading_consent_at, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')`,
      [user.id, account.id, server, mode, mode === "real" ? new Date() : null]
    );
    return Response.json({
      accountId: account.id,
      configurationUrl: typeof configLink === "string" ? configLink : configLink?.url,
      status: "pending",
      message: "Complete the MetaApi-hosted account configuration. NexusFX does not store your MT5 password."
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (createdMetaAccount) await createdMetaAccount.remove().catch(() => {});
    if (error?.code === "23505") return Response.json({ error: "An MT5 account is already linked to this subscriber, or this MetaApi account is already linked." }, { status: 409 });
    return authError(error);
  }
}
