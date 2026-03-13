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

  const apiUrl = String((res.data as any)?.evolution_api_url ?? "").trim();
  const apiKey = String((res.data as any)?.evolution_global_api_key ?? "").trim();

  if (!apiUrl || !apiKey) {
    return {
      ok: false as const,
      error: "Evolution não configurada. Preencha URL e Global API Key no Painel WhatsApp.",
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

function extractStateFromInstance(instance: any) {
  const candidates = [
    instance?.state,
    instance?.status,
    instance?.connectionStatus,
    instance?.connectionState,
    instance?.connection,
    instance?.instance?.state,
    instance?.instance?.status,
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }

  return null;
}

export async function GET() {
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

  const url = new URL("/instance/fetchInstances", baseUrl).toString();
  const res = await fetch(url, { method: "GET", headers, cache: "no-store" });

  const text = await res.text().catch(() => "");
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  const listArray = Array.isArray(json) ? json : Array.isArray(json?.instances) ? json.instances : null;
  const found = Array.isArray(listArray)
    ? listArray.find((i: any) => {
        const name = String(i?.instanceName ?? i?.name ?? i?.instance ?? i?.instance?.instanceName ?? "");
        return name === instanceName;
      })
    : null;

  const state = found ? extractStateFromInstance(found) : null;
  const stateNormalized = state ? state.toLowerCase() : null;
  const isOpen = stateNormalized ? ["open", "opened", "connected", "online"].includes(stateNormalized) : false;

  return NextResponse.json({
    ok: res.ok,
    status: res.status,
    instanceName,
    state,
    isOpen,
    found: Boolean(found),
    raw: found ?? null,
    error: res.ok ? null : text?.slice(0, 2000) ?? null,
  });
}
