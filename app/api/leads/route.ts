import { NextResponse } from "next/server";

import { getSupabaseClient } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

function sanitizePhone(input: string) {
  return input.replace(/[^0-9+]/g, "").trim();
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  } as Record<string, string>;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: Request) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        error: "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      },
      { status: 500, headers: corsHeaders() },
    );
  }

  const body = await req.json().catch(() => null);

  const nome = (body?.nome ?? body?.name ?? body?.full_name ?? "").toString().trim();
  const telefone = sanitizePhone((body?.telefone ?? body?.phone ?? "").toString());
  const email = (body?.email ?? "").toString().trim() || null;
  const mensagem = (body?.mensagem ?? body?.message ?? "").toString().trim() || null;
  const slug_imovel = (body?.slug_imovel ?? body?.slug ?? body?.property_slug ?? "").toString().trim() || null;

  if (!nome || !telefone) {
    return NextResponse.json(
      { ok: false, error: "nome e telefone são obrigatórios" },
      { status: 400, headers: corsHeaders() },
    );
  }

  const payload = {
    id: crypto.randomUUID(),
    full_name: nome,
    phone: telefone,
    email,
    message: mensagem,
    slug_imovel,
    interest: slug_imovel,
    stage: "recebido" as const,
    source: "elementor" as const,
    assigned_broker_profile_id: null,
    created_at: new Date().toISOString(),
  };

  try {
    const { error } = await (supabase as any).from("leads").insert(payload);
    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          code: (error as any)?.code ?? null,
          details: (error as any)?.details ?? null,
          hint: (error as any)?.hint ?? null,
        },
        { status: 400, headers: corsHeaders() },
      );
    }

    return NextResponse.json({ ok: true }, { status: 200, headers: corsHeaders() });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Falha ao criar lead." },
      { status: 500, headers: corsHeaders() },
    );
  }
}
