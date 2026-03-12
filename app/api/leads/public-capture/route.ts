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

function getMissingColumnFromError(err: any) {
  const msg = String(err?.message ?? "");
  const match = msg.match(/Could not find the '([^']+)' column/i);
  if (match?.[1]) return match[1];
  const alt = msg.match(/column\s+"?([^\s\"]+)"?\s+does\s+not\s+exist/i);
  if (alt?.[1]) return alt[1];
  return null;
}

function allowedOriginsFromEnv() {
  const raw =
    process.env.PUBLIC_LEAD_CAPTURE_ORIGINS ||
    process.env.NEXT_PUBLIC_PUBLIC_LEAD_CAPTURE_ORIGINS ||
    "";
  const list = raw
    .split(/[,\n\r\t ]+/)
    .map((s) => s.trim().replace(/\/$/g, ""))
    .filter(Boolean);
  return list;
}

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin");
  const requestHeaders = req.headers.get("access-control-request-headers");

  const allowed = allowedOriginsFromEnv();

  const normalizedOrigin = origin?.trim().replace(/\/$/g, "") || null;

  let allowOrigin = "*";
  if (normalizedOrigin && allowed.length > 0) {
    allowOrigin = allowed.includes(normalizedOrigin) ? normalizedOrigin : "";
  }

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": requestHeaders ? requestHeaders : "Content-Type",
    "Access-Control-Max-Age": "86400",
  };

  if (allowOrigin) {
    headers["Access-Control-Allow-Origin"] = allowOrigin;
    headers["Vary"] = "Origin";
  }

  return headers;
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: Request) {
  const headers = corsHeaders(req);

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

  const bairroLabel = (bairro ?? "").trim();
  const tipoLabel = (tipo ?? "").trim();
  const valorLabel = typeof valor_max === "number" && Number.isFinite(valor_max) ? formatCurrencyBRL(valor_max) : "-";

  const observacao = `Busca: ${tipoLabel || "-"} | Bairro: ${bairroLabel || "-"} | Valor: ${valorLabel}`;

  const sourceLabel = String(origem ?? "").trim() || "public_capture";

  const basePayload: any = {
    id: leadId,
    created_at: nowIso,
    stage: "recebido",
    source: sourceLabel,
    full_name: nome,
    name: nome,
    phone: whatsapp,
    whatsapp,
    notes: observacao,
    observations: observacao,
    description: observacao,
  };

  const tryPayload: any = { ...basePayload };
  let lastError: any = null;

  for (let i = 0; i < 12; i++) {
    const { error } = await (supabase as any).from("leads").insert(tryPayload);
    if (!error) {
      lastError = null;
      break;
    }

    lastError = error;
    const missing = getMissingColumnFromError(error);
    if (!missing) break;

    if (missing in tryPayload) {
      delete tryPayload[missing];
      continue;
    }

    break;
  }

  if (lastError) {
    return NextResponse.json({ ok: false, error: lastError.message }, { status: 400, headers });
  }

  return NextResponse.json({ ok: true, id: leadId }, { status: 200, headers });
}
