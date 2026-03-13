import { NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getServiceSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
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
    db: {
      schema: "public",
    },
  });
}

export async function POST(req: Request) {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "Service role não configurada. Defina SUPABASE_SERVICE_ROLE_KEY (recomendado) no ambiente do servidor.",
      },
      { status: 500 },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const action = body?.action;
  const payload = body?.payload;

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  try {
    if (action === "update") {
      const id = body?.id ?? payload?.id;
      if (!id) return NextResponse.json({ error: "ID obrigatório para update" }, { status: 400 });

      const { data, error } = await (supabase as any)
        .from("properties")
        .update(payload)
        .eq("id", id)
        .select("id")
        .single();

      if (error) return NextResponse.json({ error: error.message, details: (error as any) }, { status: 400 });
      return NextResponse.json({ data });
    }

    const { data, error } = await (supabase as any).from("properties").insert(payload).select("id").single();

    if (error) return NextResponse.json({ error: error.message, details: (error as any) }, { status: 400 });
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Falha inesperada" }, { status: 500 });
  }
}
