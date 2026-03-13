import { NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function normalizeBaseUrl(url: string) {
  const raw = String(url ?? "").trim();
  return raw.replace(/\/+$/, "");
}

function toAbsoluteBaseUrl(input: string) {
  const raw = normalizeBaseUrl(input);
  if (!raw) return null;

  try {
    return new URL(raw);
  } catch {
    try {
      return new URL(`http://${raw}`);
    } catch {
      return null;
    }
  }
}

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

async function loadEvolutionSettings() {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return {
      ok: false as const,
      error:
        "Service role não configurada. Defina SUPABASE_SERVICE_ROLE_KEY no ambiente do servidor para bypass do RLS.",
    };
  }

  const res = await (supabase as any)
    .from("whatsapp_settings")
    .select("evolution_api_url, evolution_global_api_key, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (res.error) {
    return { ok: false as const, error: res.error.message };
  }

  const row = res.data as any;
  const dbApiUrl = String(row?.evolution_api_url ?? "").trim();
  const dbApiKey = String(row?.evolution_global_api_key ?? "").trim();
  const envApiUrl = String(
    process.env.EVOLUTION_API_URL ??
      process.env.EVOLUTION_BASE_URL ??
      process.env.EVOLUTION_URL ??
      "",
  ).trim();
  const envApiKey = String(
    process.env.EVOLUTION_API_KEY ?? process.env.EVOLUTION_GLOBAL_API_KEY ?? "",
  ).trim();
  const apiUrl = envApiUrl || dbApiUrl;
  const apiKey = envApiKey || dbApiKey;

  if (!apiUrl || !apiKey) {
    return {
      ok: false as const,
      error: "Configuração da Evolution ausente. Preencha URL e Global API Key no Painel WhatsApp.",
    };
  }

  return { ok: true as const, apiUrl, apiKey };
}

function buildAuthHeaders(globalKey: string) {
  return {
    apikey: globalKey,
    "x-api-key": globalKey,
    "X-Api-Key": globalKey,
    Authorization: `Bearer ${globalKey}`,
    "Content-Type": "application/json",
  } as Record<string, string>;
}

async function safeJsonOrText(res: Response) {
  const text = await res.text().catch(() => "");
  try {
    return { json: text ? JSON.parse(text) : null, text: null as string | null };
  } catch {
    return { json: null as any, text: text ? text.slice(0, 2000) : null };
  }
}

export async function POST() {
  const settings = await loadEvolutionSettings();
  if (!settings.ok) {
    return NextResponse.json({ ok: false, error: settings.error }, { status: 500 });
  }

  const baseUrl = toAbsoluteBaseUrl(settings.apiUrl);
  if (!baseUrl) {
    return NextResponse.json({ ok: false, error: "URL da Evolution inválida." }, { status: 400 });
  }

  const instanceName = "boss_imob";
  const headers = buildAuthHeaders(settings.apiKey);

  const logoutUrl = new URL(`/instance/logout/${instanceName}`, baseUrl).toString();
  const deleteUrl = new URL(`/instance/delete/${instanceName}`, baseUrl).toString();

  const logoutRes = await fetch(logoutUrl, {
    method: "DELETE",
    headers,
    cache: "no-store",
  }).catch(
    (e: any) =>
      ({ ok: false, status: 0, text: async () => String(e?.message ?? e) }) as any,
  );

  const logoutPayload = await safeJsonOrText(logoutRes as any);

  const deleteRes = await fetch(deleteUrl, {
    method: "DELETE",
    headers,
    cache: "no-store",
  }).catch(
    (e: any) =>
      ({ ok: false, status: 0, text: async () => String(e?.message ?? e) }) as any,
  );

  const deletePayload = await safeJsonOrText(deleteRes as any);

  const ok = Boolean((deleteRes as any)?.ok) || (deleteRes as any)?.status === 404;

  return NextResponse.json({
    ok,
    instanceName,
    logout: {
      status: (logoutRes as any)?.status ?? null,
      ok: Boolean((logoutRes as any)?.ok),
      ...logoutPayload,
    },
    delete: {
      status: (deleteRes as any)?.status ?? null,
      ok: Boolean((deleteRes as any)?.ok),
      ...deletePayload,
    },
  });
}
