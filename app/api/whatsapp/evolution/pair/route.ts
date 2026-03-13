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

function extractQrFromInstance(instance: any) {
  const candidates = [
    instance?.qr,
    instance?.qrCode,
    instance?.qrcode,
    instance?.qr_code,
    instance?.qrCodeBase64,
    instance?.qr_code_base64,
    instance?.qr_base64,
    instance?.qrCodeImage,
    instance?.qr_code_image,
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
    if (c && typeof c === "object") {
      const inner =
        c?.base64 ||
        c?.qr ||
        c?.qrcode ||
        c?.qrCode ||
        c?.image ||
        c?.src ||
        c?.url;
      if (typeof inner === "string" && inner.trim()) return inner.trim();
    }
  }

  return null;
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

  // 1) create/ensure instance
  const createUrl = new URL("/instance/create", baseUrl).toString();
  const createRes = await fetch(createUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ instanceName }),
    cache: "no-store",
  }).catch((e: any) => ({ ok: false, status: 0, json: async () => null, text: async () => String(e?.message ?? e) }) as any);

  const createBodyText = await createRes.text().catch(() => "");
  let createJson: any = null;
  try {
    createJson = createBodyText ? JSON.parse(createBodyText) : null;
  } catch {
    createJson = null;
  }

  // 2) force QR generation
  const connectUrl = new URL(`/instance/connect/${instanceName}`, baseUrl).toString();
  const connectRes = await fetch(connectUrl, {
    method: "GET",
    headers,
    cache: "no-store",
  }).catch(
    (e: any) =>
      ({ ok: false, status: 0, json: async () => null, text: async () => String(e?.message ?? e) }) as any,
  );

  const connectBodyText = await connectRes.text().catch(() => "");
  let connectJson: any = null;
  try {
    connectJson = connectBodyText ? JSON.parse(connectBodyText) : null;
  } catch {
    connectJson = null;
  }

  const reqHeaders = req.headers;
  const forwardedProto = reqHeaders.get("x-forwarded-proto");
  const proto = forwardedProto ? String(forwardedProto).split(",")[0].trim() : "https";
  const forwardedHost = reqHeaders.get("x-forwarded-host");
  const host = forwardedHost ? String(forwardedHost).split(",")[0].trim() : reqHeaders.get("host");
  const webhookUrl = host ? `${proto}://${host}/api/whatsapp/webhook` : null;

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
    }).catch(
      (e: any) =>
        ({ ok: false, status: 0, json: async () => null, text: async () => String(e?.message ?? e) }) as any,
    );

    const setText = await setRes.text().catch(() => "");
    let setJson: any = null;
    try {
      setJson = setText ? JSON.parse(setText) : null;
    } catch {
      setJson = null;
    }

    webhookSet = {
      url: webhookUrl,
      status: (setRes as any)?.status ?? null,
      ok: Boolean((setRes as any)?.ok),
      json: setJson,
      text: setJson ? null : setText?.slice(0, 2000) ?? null,
    };
  }

  let qrRaw = connectJson ? extractQrFromConnectResponse(connectJson) : null;

  // 3) fallback: fetch instances and try to extract QR
  const listUrl = new URL("/instance/fetchInstances", baseUrl).toString();
  const listRes = await fetch(listUrl, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  const listText = await listRes.text().catch(() => "");
  let listJson: any = null;
  try {
    listJson = listText ? JSON.parse(listText) : null;
  } catch {
    listJson = null;
  }

  const listArray = Array.isArray(listJson) ? listJson : Array.isArray(listJson?.instances) ? listJson.instances : null;
  const found = listArray?.find((i: any) => {
    const name = String(i?.instanceName ?? i?.name ?? i?.instance ?? "");
    return name === instanceName;
  });

  if (!qrRaw) {
    qrRaw = found ? extractQrFromInstance(found) : null;
  }

  // Normalize base64 into data URL when needed
  let qrDataUrl: string | null = null;
  if (qrRaw) {
    if (qrRaw.startsWith("data:image")) {
      qrDataUrl = qrRaw;
    } else if (/^https?:\/\//i.test(qrRaw)) {
      qrDataUrl = qrRaw;
    } else {
      // assume base64 png
      const cleaned = qrRaw.replace(/^data:image\/[a-zA-Z]+;base64,/, "");
      qrDataUrl = `data:image/png;base64,${cleaned}`;
    }
  }

  return NextResponse.json({
    ok: true,
    instanceName,
    webhookSet,
    create: {
      status: (createRes as any)?.status ?? null,
      ok: Boolean((createRes as any)?.ok),
      json: createJson,
      text: createJson ? null : createBodyText?.slice(0, 2000) ?? null,
    },
    connect: {
      status: (connectRes as any)?.status ?? null,
      ok: Boolean((connectRes as any)?.ok),
      json: connectJson,
      text: connectJson ? null : connectBodyText?.slice(0, 2000) ?? null,
    },
    fetchInstances: {
      status: listRes.status,
      ok: listRes.ok,
      rawCount: Array.isArray(listArray) ? listArray.length : null,
    },
    qr: {
      found: Boolean(found),
      dataUrl: qrDataUrl,
      raw: qrRaw,
    },
  });
}
