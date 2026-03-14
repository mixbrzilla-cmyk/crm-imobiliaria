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

export async function GET() {
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

  const url = new URL(`/webhook/find/${instanceName}`, baseUrl).toString();
  const res = await fetch(url, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  const text = await res.text().catch(() => "");
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return NextResponse.json({
    ok: res.ok,
    status: res.status,
    instanceName,
    json,
    text: json ? null : text?.slice(0, 2000) ?? null,
  });
}
