import { query } from "../../../../lib/db.js";
import { requireAdmin } from "../../../../lib/admin-auth.js";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request) {
  try {
    requireAdmin(request);
    const result=await query("SELECT id,title,body,published,created_at FROM admin_news ORDER BY created_at DESC LIMIT 100");
    return Response.json({items:result.rows},{headers:{"Cache-Control":"no-store"}});
  } catch(error) {
    return Response.json({error:error?.status===401?error.message:"News database unavailable."},{status:error?.status||503});
  }
}

export async function POST(request) {
  try {
    requireAdmin(request);
    const body=await request.json();
    const title=String(body?.title||"").trim();
    const text=String(body?.body||"").trim();
    if(title.length<1||title.length>160||text.length<1||text.length>5000) {
      return Response.json({error:"Title must be 1–160 characters and body 1–5000 characters."},{status:400});
    }
    const result=await query("INSERT INTO admin_news (title,body,published) VALUES ($1,$2,TRUE) RETURNING id,title,body,published,created_at",[title,text]);
    return Response.json({item:result.rows[0]},{status:201,headers:{"Cache-Control":"no-store"}});
  } catch(error) {
    return Response.json({error:error?.status===401?error.message:"Could not publish news."},{status:error?.status||503});
  }
}

export async function DELETE(request) {
  try {
    requireAdmin(request);
    const id=new URL(request.url).searchParams.get("id");
    if(!id)return Response.json({error:"News item id is required."},{status:400});
    await query("DELETE FROM admin_news WHERE id=$1",[id]);
    return Response.json({deleted:true},{headers:{"Cache-Control":"no-store"}});
  } catch(error) {
    return Response.json({error:error?.status===401?error.message:"Could not delete news."},{status:error?.status||503});
  }
}
