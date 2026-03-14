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

function unwrapEvolutionList(json: any) {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.result)) return json.result;
  if (Array.isArray(json?.response)) return json.response;
  if (Array.isArray(json?.chats)) return json.chats;
  if (Array.isArray(json?.chat)) return json.chat;
  if (Array.isArray(json?.data?.chats)) return json.data.chats;
  return [];
}

function jidToPhone(jid: string | null) {
  const raw = String(jid ?? "");
  const beforeAt = raw.includes("@") ? raw.split("@")[0] : raw;
  const digits = beforeAt.replace(/\D+/g, "").trim();
  return digits || null;
}

function safeString(v: unknown) {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return null;
}

function extractChatNumber(chat: any) {
  const jid =
    safeString(chat?.id) ||
    safeString(chat?.jid) ||
    safeString(chat?.remoteJid) ||
    safeString(chat?.contact?.id) ||
    safeString(chat?.contact?.jid) ||
    null;
  if (jid && String(jid).includes("@g.us")) return null;
  return jidToPhone(jid);
}

function extractChatName(chat: any) {
  const raw = (
    safeString(chat?.name) ||
    safeString(chat?.profileName) ||
    safeString(chat?.profile_name) ||
    safeString(chat?.pushName) ||
    safeString(chat?.subject) ||
    safeString(chat?.contact?.name) ||
    safeString(chat?.contact?.profileName) ||
    safeString(chat?.contact?.pushName) ||
    null
  );

  const cleaned = String(raw ?? "").trim();
  if (!cleaned) return null;
  if (/^\d+$/.test(cleaned)) return null;
  return cleaned;
}

function extractLastMessagePreview(chat: any) {
  const last = chat?.lastMessage ?? chat?.last_message ?? chat?.last ?? null;
  const text = safeString(last?.text) || safeString(last?.message) || safeString(last?.body) || null;
  return text;
}

function extractAvatarUrl(chat: any) {
  const candidates = [
    chat?.profilePic,
    chat?.profilePicUrl,
    chat?.profilePictureUrl,
    chat?.pictureUrl,
    chat?.avatarUrl,
    chat?.contact?.profilePic,
    chat?.contact?.profilePicUrl,
    chat?.contact?.profilePictureUrl,
    chat?.contact?.pictureUrl,
    chat?.contact?.avatarUrl,
  ];
  for (const c of candidates) {
    const s = safeString(c);
    if (!s) continue;
    if (s.startsWith("http")) return s;
    if (s.startsWith("data:image/")) return s;
  }
  return null;
}

function proxiedAvatarUrl(avatarUrl: string | null) {
  const raw = safeString(avatarUrl);
  if (!raw) return null;
  if (raw.startsWith("data:image/")) return raw;
  if (!raw.startsWith("http")) return null;
  return `/api/whatsapp/evolution/avatar?url=${encodeURIComponent(raw)}`;
}

export async function GET() {
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

  try {
    const url = new URL(`/chat/findChats/${instanceName}`, baseUrl).toString();
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
      json = text;
    }

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Falha ao buscar chats. HTTP ${res.status}. ${text}` },
        { status: 502 },
      );
    }

    const list = unwrapEvolutionList(json);

    const chats = list
      .map((c: any) => {
        const number = extractChatNumber(c);
        if (!number) return null;
        const avatar = extractAvatarUrl(c);
        return {
          number,
          name: extractChatName(c),
          lastMessage: extractLastMessagePreview(c),
          avatarUrl: proxiedAvatarUrl(avatar),
          raw: c,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ ok: true, instanceName, count: chats.length, chats });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Falha ao buscar chats." },
      { status: 500 },
    );
  }
}
