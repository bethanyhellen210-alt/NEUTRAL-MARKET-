import { query } from "../../../../lib/db.js";
import { requireAdmin } from "../../../../lib/admin-auth.js";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request) {
  try {
    requireAdmin(request);
    const result=await query(
      `SELECT u.id AS user_id,u.email,u.created_at AS registered_at,
              s.plan,s.currency,s.amount_cents,s.status AS subscription_status,s.expires_at
         FROM users u LEFT JOIN LATERAL (
           SELECT plan,currency,amount_cents,status,expires_at
             FROM subscriptions WHERE user_id=u.id
            ORDER BY created_at DESC LIMIT 1
         ) s ON TRUE
        ORDER BY u.created_at DESC LIMIT 500`
    );
    return Response.json({subscribers:result.rows},{headers:{"Cache-Control":"no-store"}});
  } catch(error) {
    return Response.json({error:error?.status===401?error.message:"Subscriber database unavailable."},{status:error?.status||503});
  }
}
