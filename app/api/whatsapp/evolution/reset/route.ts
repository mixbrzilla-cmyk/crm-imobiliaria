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
