import { NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    db: { schema: "public" },
  });
}

export async function POST(req: Request) {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        error: "Service role não configurada. Defina SUPABASE_SERVICE_ROLE_KEY no ambiente do servidor.",
      },
      { status: 500 },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 });
  }

  const action = String(body?.action ?? "").trim();
  const id = String(body?.id ?? body?.payload?.id ?? "").trim();
  const payload = body?.payload;

  if (!action) return NextResponse.json({ ok: false, error: "Action obrigatório" }, { status: 400 });
  if (!id) return NextResponse.json({ ok: false, error: "ID obrigatório" }, { status: 400 });

  try {
    if (action === "update") {
      if (!payload || typeof payload !== "object") {
        return NextResponse.json({ ok: false, error: "Payload inválido" }, { status: 400 });
      }

      const { data, error } = await (supabase as any)
        .from("legal_cases")
        .update(payload)
        .eq("id", id)
        .select("id")
        .single();

      if (error) return NextResponse.json({ ok: false, error: error.message, details: error }, { status: 400 });
      return NextResponse.json({ ok: true, data });
    }

    if (action === "delete") {
      const { error } = await (supabase as any).from("legal_cases").delete().eq("id", id);
      if (error) return NextResponse.json({ ok: false, error: error.message, details: error }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Action inválido" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Falha inesperada" }, { status: 500 });
  }
}
