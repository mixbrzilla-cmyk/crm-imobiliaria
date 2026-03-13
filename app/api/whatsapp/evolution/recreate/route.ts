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

async function safeText(res: any) {
  const text = await res.text().catch(() => "");
  return (text ?? "").slice(0, 2000);
}

function extractQrFromConnectResponse(payload: any) {
  const candidates = [
    payload?.qr,
    payload?.qrCode,
    payload?.qrcode,
    payload?.qr_code,
    payload?.qrCodeBase64,
    payload?.qr_code_base64,
    payload?.base64,
    payload?.data,
    payload?.instance,
    payload?.instanceData,
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
    if (c && typeof c === "object") {
      const inner =
        c?.base64 ||
        c?.qr ||
        c?.qrcode ||
        c?.qrCode ||
        c?.qr_code ||
        c?.image ||
        c?.src ||
        c?.url;
      if (typeof inner === "string" && inner.trim()) return inner.trim();
    }
  }

  return null;
}

function normalizeQrToDataUrl(qrRaw: string | null) {
  if (!qrRaw) return null;
  if (qrRaw.startsWith("data:image")) return qrRaw;
  if (/^https?:\/\//i.test(qrRaw)) return qrRaw;
  const cleaned = qrRaw.replace(/^data:image\/[a-zA-Z]+;base64,/, "");
  return `data:image/png;base64,${cleaned}`;
}

function inferWebhookUrl(req: Request) {
  const reqHeaders = req.headers;
  const forwardedProto = reqHeaders.get("x-forwarded-proto");
  const proto = forwardedProto ? String(forwardedProto).split(",")[0].trim() : "https";
  const forwardedHost = reqHeaders.get("x-forwarded-host");
  const host = forwardedHost ? String(forwardedHost).split(",")[0].trim() : reqHeaders.get("host");
  if (!host) return null;
  return `${proto}://${host}/api/whatsapp/webhook`;
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

  const logoutUrl = new URL(`/instance/logout/${instanceName}`, baseUrl).toString();
  const deleteUrl = new URL(`/instance/delete/${instanceName}`, baseUrl).toString();

  const logoutRes = await fetch(logoutUrl, { method: "DELETE", headers, cache: "no-store" }).catch(
    (e: any) => ({ ok: false, status: 0, text: async () => String(e?.message ?? e) }) as any,
  );
  const deleteRes = await fetch(deleteUrl, { method: "DELETE", headers, cache: "no-store" }).catch(
    (e: any) => ({ ok: false, status: 0, text: async () => String(e?.message ?? e) }) as any,
  );

  // recreate
  const createUrl = new URL("/instance/create", baseUrl).toString();
  const createRes = await fetch(createUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ instanceName }),
    cache: "no-store",
  }).catch((e: any) => ({ ok: false, status: 0, text: async () => String(e?.message ?? e) }) as any);

  const connectUrl = new URL(`/instance/connect/${instanceName}`, baseUrl).toString();
  const connectRes = await fetch(connectUrl, {
    method: "GET",
    headers,
    cache: "no-store",
  }).catch((e: any) => ({ ok: false, status: 0, text: async () => String(e?.message ?? e) }) as any);

  const connectText = await connectRes.text().catch(() => "");
  let connectJson: any = null;
  try {
    connectJson = connectText ? JSON.parse(connectText) : null;
  } catch {
    connectJson = null;
  }

  const webhookUrl = inferWebhookUrl(req);
  let webhookSet: any = null;
  if (webhookUrl) {
    const setUrl = new URL(`/webhook/set/${instanceName}`, baseUrl).toString();
    const setRes = await fetch(setUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        enabled: true,
        url: webhookUrl,
        webhookByEvents: true,
        webhookBase64: true,
        events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
      }),
      cache: "no-store",
    }).catch((e: any) => ({ ok: false, status: 0, text: async () => String(e?.message ?? e) }) as any);

    webhookSet = {
      ok: Boolean((setRes as any)?.ok),
      status: (setRes as any)?.status ?? null,
      text: await safeText(setRes as any),
      url: webhookUrl,
    };
  }

  const qrRaw = connectJson ? extractQrFromConnectResponse(connectJson) : null;
  const qrDataUrl = normalizeQrToDataUrl(qrRaw);

  const ok = Boolean((createRes as any)?.ok) && Boolean((connectRes as any)?.ok);

  return NextResponse.json({
    ok,
    instanceName,
    qr: {
      dataUrl: qrDataUrl,
      raw: qrRaw,
    },
    webhookSet,
    logout: { ok: Boolean((logoutRes as any)?.ok), status: (logoutRes as any)?.status ?? null },
    delete: { ok: Boolean((deleteRes as any)?.ok), status: (deleteRes as any)?.status ?? null },
    create: { ok: Boolean((createRes as any)?.ok), status: (createRes as any)?.status ?? null, text: await safeText(createRes as any) },
    connect: {
      ok: Boolean((connectRes as any)?.ok),
      status: (connectRes as any)?.status ?? null,
      json: connectJson,
      text: connectJson ? null : connectText?.slice(0, 2000) ?? null,
    },
  });
}
