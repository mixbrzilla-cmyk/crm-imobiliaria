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

function buildAuthHeaders(apiKey: string) {
  return {
    apikey: apiKey,
    "x-api-key": apiKey,
    "X-Api-Key": apiKey,
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  } as Record<string, string>;
}

function safeString(v: unknown) {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return null;
}

function normalizeWhatsapp(value: string) {
  return String(value ?? "")
    .replace(/\D+/g, "")
    .trim();
}

function extractTextFromMessage(message: any) {
  const direct = safeString(message?.conversation);
  if (direct) return direct;
  const ext = safeString(message?.extendedTextMessage?.text);
  if (ext) return ext;
  const imgCap = safeString(message?.imageMessage?.caption);
  if (imgCap) return imgCap;
  const vidCap = safeString(message?.videoMessage?.caption);
  if (vidCap) return vidCap;
  return "";
}

function unwrapEvolutionList(json: any) {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.result)) return json.result;
  if (Array.isArray(json?.messages)) return json.messages;
  if (Array.isArray(json?.data?.messages)) return json.data.messages;
  return [];
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const phone = normalizeWhatsapp(searchParams.get("phone") ?? "");

  if (!phone) {
    return NextResponse.json({ ok: false, error: "phone é obrigatório" }, { status: 400 });
  }

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

  const apiUrl = envApiUrl;
  const apiKey = envInstanceKey || envGlobalKey;

  if (!apiUrl || !apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "Evolution não configurada no ambiente do servidor.",
        missing: {
          apiUrl: !apiUrl,
          apiKey: !apiKey,
        },
      },
      { status: 500 },
    );
  }

  const baseUrl = toAbsoluteBaseUrl(apiUrl);
  if (!baseUrl) {
    return NextResponse.json({ ok: false, error: "URL da Evolution inválida." }, { status: 400 });
  }

  const instanceName = "boss_imob";
  const headers = buildAuthHeaders(apiKey);

  const remoteJid = `${phone}@s.whatsapp.net`;

  try {
    const url = new URL(`/chat/findMessages/${instanceName}`, baseUrl).toString();
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ where: { key: { remoteJid } } }),
      cache: "no-store",
    });

    const text = await res.text().catch(() => "");
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Falha ao buscar mensagens. HTTP ${res.status}. ${text}` },
        { status: 502 },
      );
    }

    const list = unwrapEvolutionList(json);

    const messages = list
      .map((m: any) => {
        const key = m?.key ?? {};
        const fromMe = Boolean(key?.fromMe);
        const message = m?.message ?? m;
        const tsRaw = safeString(m?.messageTimestamp ?? m?.timestamp);
        const iso = tsRaw && /^\d+$/.test(tsRaw) ? new Date(Number(tsRaw) * 1000).toISOString() : new Date().toISOString();
        const msgText = extractTextFromMessage(message);
        if (!msgText) return null;
        return {
          id: safeString(key?.id) ?? crypto.randomUUID(),
          direction: fromMe ? ("out" as const) : ("in" as const),
          message: msgText,
          sent_at: iso,
          raw: m,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ ok: true, phone, remoteJid, count: messages.length, messages });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Falha ao buscar mensagens." }, { status: 500 });
  }
}
