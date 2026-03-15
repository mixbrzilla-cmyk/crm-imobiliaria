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

function normalizeWhatsapp(v: string) {
  return String(v ?? "").replace(/\D+/g, "").trim();
}

export async function POST(req: Request) {
  const requiredKey =
    process.env.LEAD_RECEIVER_API_KEY ||
    process.env.NEXT_PUBLIC_LEAD_RECEIVER_API_KEY ||
    "";

  const url = new URL(req.url);
  const keyFromQuery = url.searchParams.get("api_key") ?? "";
  const keyFromHeader = req.headers.get("x-api-key") ?? req.headers.get("authorization") ?? "";
  const providedKey = (keyFromHeader.startsWith("Bearer ")
    ? keyFromHeader.slice("Bearer ".length)
    : keyFromHeader) || keyFromQuery;

  if (!requiredKey || providedKey !== requiredKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const fullName = String(body?.nome ?? body?.name ?? "").trim();
  const whatsapp = normalizeWhatsapp(String(body?.whatsapp ?? body?.phone ?? body?.telefone ?? ""));
  const origin = String(body?.origem ?? body?.origin ?? body?.source ?? "").trim();
  const message = String(body?.mensagem ?? body?.message ?? "").trim();

  if (!whatsapp) {
    return NextResponse.json({ error: "whatsapp é obrigatório" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();

  try {
    const leadId = crypto.randomUUID();
    const payload: any = {
      id: leadId,
      created_at: nowIso,
      stage: "recebido",
      source: origin || "Lead Receiver",
      full_name: fullName,
      phone: whatsapp,
      interest: message || null,
    };

    const { error } = await (supabase as any).from("leads").insert(payload);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    try {
      await (supabase as any).from("interaction_logs").insert({
        id: crypto.randomUUID(),
        event_type: "lead_receiver_register",
        target_type: "lead",
        target_id: leadId,
        created_at: nowIso,
        meta: {
          origin: origin || null,
          message: message || null,
          phone: whatsapp,
          full_name: fullName || null,
        },
      });
    } catch {
      // ignore
    }

    return NextResponse.json({ ok: true, lead_id: leadId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Falha inesperada" }, { status: 500 });
  }
}
