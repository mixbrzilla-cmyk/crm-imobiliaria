import { NextResponse } from "next/server";

import { getSupabaseClient } from "@/lib/supabaseClient";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sanitizePhone(input: string) {
  return input.replace(/[^0-9+]/g, "").trim();
}

function normalizeCpf(input: string) {
  return String(input ?? "").replace(/\D+/g, "").trim();
}

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

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  } as Record<string, string>;
}

function isMissingColumnError(err: any, columnName: string) {
  const msg = String(err?.message ?? "");
  const details = String(err?.details ?? "");
  const hint = String(err?.hint ?? "");
  const haystack = `${msg} ${details} ${hint}`.toLowerCase();
  return haystack.includes(`'${columnName.toLowerCase()}'`) && haystack.includes("column");
}

function getMissingColumnFromError(err: any) {
  const known = ["address", "cpf", "intent", "value_max"] as const;
  for (const c of known) {
    if (isMissingColumnError(err, c)) return c;
  }
  const msg = String(err?.message ?? "");
  const match = msg.match(/Could not find the '([^']+)' column/i);
  if (match?.[1]) return match[1];
  return null;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: Request) {
  const supabase = getServiceSupabase() || getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e (NEXT_PUBLIC_SUPABASE_ANON_KEY ou SUPABASE_SERVICE_ROLE_KEY).",
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

  const cpf = normalizeCpf(body?.cpf ?? body?.document ?? "") || null;
  const address = (body?.address ?? body?.endereco ?? "").toString().trim() || null;
  const rawIntent = (body?.intent ?? body?.intencao ?? "").toString().trim().toLowerCase();
  const intent = rawIntent === "comprar" || rawIntent === "alugar" ? rawIntent : null;

  const prefs = body?.preferences ?? body?.customer_preferences ?? null;
  const tipo_imovel = (prefs?.tipo_imovel ?? body?.tipo_imovel ?? "").toString().trim() || null;
  const bairro = (prefs?.bairro ?? body?.bairro ?? "").toString().trim() || null;
  const quartosRaw = prefs?.quartos ?? body?.quartos ?? null;
  const valorMaxRaw = prefs?.valor_max ?? body?.valor_max ?? body?.valorMax ?? null;
  const quartos = typeof quartosRaw === "number" ? Math.trunc(quartosRaw) : quartosRaw ? Math.trunc(Number(quartosRaw)) : null;
  const valor_max = parseMoneyToNumberBR(valorMaxRaw);

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
    cpf,
    address,
    intent,
    value_max: typeof valor_max === "number" && Number.isFinite(valor_max) ? valor_max : null,
  };

  try {
    const tryPayload: any = { ...payload };

    let lastError: any = null;
    for (let i = 0; i < 5; i++) {
      const { error } = await (supabase as any).from("leads").insert(tryPayload);
      if (!error) {
        lastError = null;
        break;
      }

      lastError = error;
      const missing = getMissingColumnFromError(error);
      const msg = String(error?.message ?? "");
      const looksLikeSchemaMismatch = /could not find the .* column/i.test(msg) || Boolean(missing);

      if (!looksLikeSchemaMismatch) break;
      if (!missing) break;

      delete tryPayload[missing];
    }

    if (lastError) {
      return NextResponse.json(
        {
          ok: false,
          error: lastError.message,
          code: (lastError as any)?.code ?? null,
          details: (lastError as any)?.details ?? null,
          hint: (lastError as any)?.hint ?? null,
        },
        { status: 400, headers: corsHeaders() },
      );
    }

    try {
      const maybePrefs = {
        lead_id: payload.id,
        tipo_imovel,
        valor_max: typeof valor_max === "number" && Number.isFinite(valor_max) ? valor_max : null,
        quartos: typeof quartos === "number" && Number.isFinite(quartos) ? quartos : null,
        bairro,
        updated_at: new Date().toISOString(),
      };

      const hasAny =
        Boolean(maybePrefs.tipo_imovel) ||
        Boolean(maybePrefs.bairro) ||
        typeof maybePrefs.quartos === "number" ||
        typeof maybePrefs.valor_max === "number";

      if (hasAny) {
        await (supabase as any)
          .from("customer_preferences")
          .upsert(maybePrefs, { onConflict: "lead_id" });
      }
    } catch {
      // ignore
    }

    return NextResponse.json({ ok: true }, { status: 200, headers: corsHeaders() });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Falha ao criar lead." },
      { status: 500, headers: corsHeaders() },
    );
  }
}
