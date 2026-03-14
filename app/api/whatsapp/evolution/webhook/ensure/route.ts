import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

async function loadEvolutionSettings() {
  const envApiUrl = String(
    process.env.EVOLUTION_API_URL ??
      process.env.EVOLUTION_BASE_URL ??
      process.env.EVOLUTION_URL ??
      "",
  ).trim();
  const envGlobalKey = String(
    process.env.EVOLUTION_API_KEY ?? process.env.EVOLUTION_GLOBAL_API_KEY ?? "",
  ).trim();
  const envInstanceKey = String(process.env.EVOLUTION_INSTANCE_API_KEY ?? "").trim();
  const apiKey = envInstanceKey || envGlobalKey;

  if (!envApiUrl || !apiKey) {
    return {
      ok: false as const,
      error: "Evolution não configurada no ambiente do servidor.",
      missing: {
        apiUrl: !envApiUrl,
        apiKey: !apiKey,
      },
    };
  }

  return { ok: true as const, apiUrl: envApiUrl, apiKey };
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
    return NextResponse.json(
      { ok: false, error: settings.error, missing: (settings as any).missing ?? null },
      { status: 500 },
    );
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
