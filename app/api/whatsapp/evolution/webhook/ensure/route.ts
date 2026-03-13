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

  const dbApiUrl = String((res.data as any)?.evolution_api_url ?? "").trim();
  const dbApiKey = String((res.data as any)?.evolution_global_api_key ?? "").trim();
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

function inferWebhookBaseUrl(req: Request) {
  const headers = req.headers;

  const forwardedProto = headers.get("x-forwarded-proto");
  const proto = forwardedProto ? String(forwardedProto).split(",")[0].trim() : "https";

  const forwardedHost = headers.get("x-forwarded-host");
  const host = forwardedHost ? String(forwardedHost).split(",")[0].trim() : headers.get("host");

  if (host) return `${proto}://${host}`;

  const envCandidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.SITE_URL,
    process.env.APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  ]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);

  for (const c of envCandidates) {
    const u = toAbsoluteBaseUrl(c);
    if (u) return u.toString().replace(/\/+$/, "");
  }

  return null;
}

async function findWebhook(baseUrl: URL, instanceName: string, headers: Record<string, string>) {
  const url = new URL(`/webhook/find/${instanceName}`, baseUrl).toString();
  const res = await fetch(url, { method: "GET", headers, cache: "no-store" });
  const text = await res.text().catch(() => "");
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return {
    ok: res.ok,
    status: res.status,
    json,
    text: json ? null : text?.slice(0, 2000) ?? null,
  };
}

export async function POST(req: Request) {
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

  const base = inferWebhookBaseUrl(req);
  if (!base) {
    return NextResponse.json(
      {
        ok: false,
        error: "Não foi possível inferir a URL pública do CRM para configurar o webhook.",
      },
      { status: 400 },
    );
  }

  const webhookUrl = `${String(base).replace(/\/+$/, "")}/api/whatsapp/webhook`;

  const setUrl = new URL(`/webhook/set/${instanceName}`, baseUrl).toString();

  const bodyPrimary = {
    enabled: true,
    url: webhookUrl,
    webhookByEvents: true,
    webhookBase64: true,
    events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
  };

  const bodyNested = {
    webhook: bodyPrimary,
  };

  let setAttempt: any = null;

  for (const body of [bodyPrimary, bodyNested]) {
    const res = await fetch(setUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    }).catch(
      (e: any) =>
        ({ ok: false, status: 0, text: async () => String(e?.message ?? e) }) as any,
    );

    const text = await res.text().catch(() => "");
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    setAttempt = {
      ok: Boolean((res as any)?.ok),
      status: (res as any)?.status ?? null,
      json,
      text: json ? null : text?.slice(0, 2000) ?? null,
      usedNested: body === bodyNested,
    };

    if ((res as any)?.ok) break;
  }

  const after = await findWebhook(baseUrl, instanceName, headers);

  return NextResponse.json({
    ok: Boolean(setAttempt?.ok) && Boolean(after?.ok),
    instanceName,
    webhookUrl,
    set: setAttempt,
    find: after,
  });
}
