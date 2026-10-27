import { query } from "../../../lib/db.js";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET() {
  try {
    const result=await query("SELECT id,title,body,created_at FROM admin_news WHERE published=TRUE ORDER BY created_at DESC LIMIT 50");
    return Response.json({items:result.rows},{headers:{"Cache-Control":"no-store"}});
  } catch {
    return Response.json({items:[],error:"News feed is unavailable until the database schema is installed."},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
