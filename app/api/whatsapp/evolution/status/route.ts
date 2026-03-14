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

  return {
    ok: true as const,
    apiUrl: envApiUrl,
    apiKey,
  };
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

function extractInstanceApiKey(instance: any) {
  const candidates = [
    instance?.token,
    instance?.apiKey,
    instance?.apikey,
    instance?.key,
    instance?.instance?.token,
    instance?.instance?.apiKey,
    instance?.instance?.apikey,
    instance?.instance?.key,
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }

  return null;
}

function extractInstanceName(instance: any) {
  const candidates = [
    instance?.instanceName,
    instance?.name,
    instance?.instance,
    instance?.instance?.instanceName,
    instance?.instance?.name,
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }

  return null;
}

function normalizeInstanceName(value: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export async function GET() {
  const settings = await loadEvolutionSettings();
  if (!settings.ok) {
    return NextResponse.json({ ok: false, error: settings.error, missing: (settings as any).missing ?? null }, { status: 500 });
  }

  const baseUrl = toAbsoluteBaseUrl(settings.apiUrl);
  if (!baseUrl) {
    return NextResponse.json({ ok: false, error: "URL da Evolution inválida." }, { status: 400 });
  }

  const instanceName = "boss_imob";
  const headers = buildAuthHeaders(settings.apiKey);

  const fetchInstancesUrl = new URL("/instance/fetchInstances", baseUrl).toString();
  const res = await fetch(fetchInstancesUrl, { method: "GET", headers, cache: "no-store" });

  const text = await res.text().catch(() => "");
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  const listArray =
    Array.isArray(json)
      ? json
      : Array.isArray(json?.instances)
        ? json.instances
        : Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.result)
            ? json.result
            : Array.isArray(json?.response)
              ? json.response
              : null;

  const targetNormalized = normalizeInstanceName(instanceName);
  const availableInstances = Array.isArray(listArray)
    ? listArray
        .map((i: any) => extractInstanceName(i))
        .filter(Boolean)
        .map((v: any) => String(v))
    : [];

  const found = Array.isArray(listArray)
    ? listArray.find((i: any) => {
        const name = extractInstanceName(i);
        if (!name) return false;
        return normalizeInstanceName(name) === targetNormalized;
      })
    : null;

  const state = found ? extractStateFromInstance(found) : null;
  const instanceApiKey = found ? extractInstanceApiKey(found) : null;
  const stateNormalized = state ? state.toLowerCase() : null;
  const isOpen = stateNormalized ? ["open", "opened", "connected", "online"].includes(stateNormalized) : false;

  return NextResponse.json({
    ok: res.ok,
    status: res.status,
    apiUrlSource: "env",
    apiKeySource: "env",
    resolvedBaseUrl: baseUrl.toString().replace(/\/+$/, ""),
    resolvedFetchInstancesUrl: fetchInstancesUrl,
    targetInstanceName: instanceName,
    instanceName,
    state,
    instanceApiKey,
    isOpen,
    found: Boolean(found),
    rawCount: Array.isArray(listArray) ? listArray.length : null,
    availableInstances,
    raw: found ?? null,
    error: res.ok ? null : text?.slice(0, 2000) ?? null,
  });
}
