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
    db: {
      schema: "public",
    },
  });
}

function sanitizePhone(input: string) {
  return String(input ?? "").replace(/[^0-9+]/g, "").trim();
}

function parseMoneyToNumberBR(input: any) {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  const raw = String(input ?? "").trim();
  if (!raw) return null;

  const cleaned = raw
    .replace(/\s+/g, "")
    .replace(/R\$?/gi, "")
    .replace(/[^0-9.,-]/g, "");

  if (!cleaned) return null;

  const hasDot = cleaned.includes(".");
  const hasComma = cleaned.includes(",");

  let normalized = cleaned;
  if (hasDot && hasComma) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    normalized = normalized.replace(",", ".");
  }

  const num = Number(normalized);
  if (!Number.isFinite(num)) return null;
  return num;
}

function formatCurrencyBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function allowedOriginsFromEnv() {
  const raw =
    process.env.PUBLIC_LEAD_CAPTURE_ORIGINS ||
    process.env.NEXT_PUBLIC_PUBLIC_LEAD_CAPTURE_ORIGINS ||
    "";
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list;
}

function corsHeaders(origin: string | null) {
  const allowed = allowedOriginsFromEnv();

  let allowOrigin = "*";
  if (origin && allowed.length > 0) {
    allowOrigin = allowed.includes(origin) ? origin : "";
  }

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };

  if (allowOrigin) {
    headers["Access-Control-Allow-Origin"] = allowOrigin;
    headers["Vary"] = "Origin";
  }

  return headers;
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (!headers["Access-Control-Allow-Origin"]) {
    return NextResponse.json({ ok: false, error: "Origin not allowed" }, { status: 403, headers });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        error: "Service role não configurada. Defina SUPABASE_SERVICE_ROLE_KEY no ambiente do servidor.",
      },
      { status: 500, headers },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400, headers });
  }

  const nome = String(body?.nome ?? "").trim();
  const whatsapp = sanitizePhone(String(body?.whatsapp ?? ""));
  const tipo = String(body?.tipo ?? "").trim() || null;
  const bairro = String(body?.bairro ?? "").trim() || null;
  const origem = String(body?.origem ?? "").trim() || null;
  const valor_max = parseMoneyToNumberBR(body?.valor_max ?? null);

  if (!nome || !whatsapp) {
    return NextResponse.json(
      { ok: false, error: "nome e whatsapp são obrigatórios" },
      { status: 400, headers },
    );
  }

  const leadId = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  const originLabel = (origem ?? "").trim();
  const originForDisplay = originLabel ? originLabel.toUpperCase() : "-";
  const bairroLabel = (bairro ?? "").trim();
  const tipoLabel = (tipo ?? "").trim();
  const buscaLabel = `${tipoLabel || "Imóvel"}${bairroLabel ? ` em ${bairroLabel}` : ""}`;
  const valorLabel = typeof valor_max === "number" && Number.isFinite(valor_max) ? formatCurrencyBRL(valor_max) : "-";
  const consolidatedMessage = `[ORIGEM: ${originForDisplay}] - Busca: ${buscaLabel} | Valor: ${valorLabel}`;

  const payload: any = {
    id: leadId,
    full_name: nome,
    phone: whatsapp,
    stage: "recebido",
    source: originLabel || "public_capture",
    message: consolidatedMessage,
    created_at: nowIso,
    assigned_broker_profile_id: null,
  };

  const insertRes = await (supabase as any).from("leads").insert(payload);
  if (insertRes?.error) {
    return NextResponse.json({ ok: false, error: insertRes.error.message }, { status: 400, headers });
  }

  try {
    const prefsPayload: any = {
      lead_id: leadId,
      tipo_imovel: tipo,
      valor_max: typeof valor_max === "number" && Number.isFinite(valor_max) ? valor_max : null,
      bairro,
      updated_at: nowIso,
    };

    const hasAny =
      Boolean(prefsPayload.tipo_imovel) ||
      Boolean(prefsPayload.bairro) ||
      typeof prefsPayload.valor_max === "number";

    if (hasAny) {
      await (supabase as any)
        .from("customer_preferences")
        .upsert(prefsPayload, { onConflict: "lead_id" });
    }
  } catch {
    // ignore
  }

  return NextResponse.json({ ok: true, id: leadId }, { status: 200, headers });
}
