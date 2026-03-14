import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeBaseUrl(url: string) {
  const raw = String(url ?? "").trim();
  return raw.replace(/\/+$/, "");
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
  if (Array.isArray(json?.data?.data)) return json.data.data;
  if (Array.isArray(json?.result)) return json.result;
  if (Array.isArray(json?.data?.result)) return json.data.result;
  if (Array.isArray(json?.response)) return json.response;
  if (Array.isArray(json?.data?.response)) return json.data.response;
  if (Array.isArray(json?.chats)) return json.chats;
  if (Array.isArray(json?.chat)) return json.chat;
  if (Array.isArray(json?.data?.chats)) return json.data.chats;
  if (Array.isArray(json?.response?.chats)) return json.response.chats;
  if (Array.isArray(json?.result?.chats)) return json.result.chats;
  if (Array.isArray(json?.data?.result?.chats)) return json.data.result.chats;

  const maybe = json as Record<string, any>;
  for (const key of ["items", "list", "conversations", "contacts", "rows", "records"]) {
    if (Array.isArray(maybe?.[key])) return maybe[key];
    if (Array.isArray(maybe?.[key]?.data)) return maybe[key].data;
  }

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
  const direct =
    safeString(chat?.number) ||
    safeString(chat?.phone) ||
    safeString(chat?.contactNumber) ||
    safeString(chat?.contact_number) ||
    safeString(chat?.contact?.number) ||
    safeString(chat?.contact?.phone) ||
    null;

  if (direct) {
    const digits = String(direct).replace(/\D+/g, "").trim();
    if (digits) return digits;
  }

  const jid =
    safeString(chat?.id) ||
    safeString(chat?.jid) ||
    safeString(chat?.remoteJid) ||
    safeString(chat?.chatId) ||
    safeString(chat?.chat_id) ||
    safeString(chat?.conversationId) ||
    safeString(chat?.conversation_id) ||
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
