export type WhatsAppSettings = {
  instance_id: string;
  token: string;
  client_key: string;
  webhook_url?: string | null;
};

export type NormalizedIncomingMessage = {
  threadExternalId: string;
  fromNumber: string | null;
  toNumber: string | null;
  messageText: string;
  timestamp: string;
  contactName: string | null;
  raw: unknown;
};

function safeString(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return null;
}

export function normalizeZApiWebhookPayload(payload: any): NormalizedIncomingMessage | null {
  if (!payload || typeof payload !== "object") return null;

  const msgText =
    safeString(payload?.message) ??
    safeString(payload?.text?.message) ??
    safeString(payload?.message?.text) ??
    safeString(payload?.body) ??
    safeString(payload?.data?.message) ??
    "";

  const fromNumber =
    safeString(payload?.from) ??
    safeString(payload?.phone) ??
    safeString(payload?.data?.from) ??
    safeString(payload?.data?.phone);

  const toNumber = safeString(payload?.to) ?? safeString(payload?.data?.to);

  const externalId =
    safeString(payload?.chatId) ??
    safeString(payload?.chat_id) ??
    safeString(payload?.conversationId) ??
    safeString(payload?.data?.chatId) ??
    fromNumber ??
    null;

  if (!externalId) return null;

  const timestamp =
    safeString(payload?.timestamp) ??
    safeString(payload?.time) ??
    safeString(payload?.data?.timestamp) ??
    new Date().toISOString();

  const contactName =
    safeString(payload?.senderName) ??
    safeString(payload?.pushName) ??
    safeString(payload?.data?.senderName) ??
    safeString(payload?.data?.pushName);

  return {
    threadExternalId: externalId,
    fromNumber,
    toNumber,
    messageText: msgText,
    timestamp,
    contactName,
    raw: payload,
  };
}

export function verifyWhatsappWebhookClientKey(input: {
  expectedClientKey: string | null;
  receivedClientKey: string | null;
}) {
  const expected = (input.expectedClientKey ?? "").trim();
  if (!expected) return true;
  const received = (input.receivedClientKey ?? "").trim();
  return received === expected;
}

export async function sendZApiTextMessage(args: {
  settings: WhatsAppSettings;
  phone: string;
  message: string;
}) {
  const base = "https://api.z-api.io";
  const url = `${base}/instances/${encodeURIComponent(args.settings.instance_id)}/token/${encodeURIComponent(
    args.settings.token,
  )}/send-text`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": args.settings.client_key,
    },
    body: JSON.stringify({
      phone: args.phone,
      message: args.message,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Falha ao enviar mensagem. Status ${res.status}. ${text}`);
  }

  return res.json().catch(() => ({}));
}

export async function validateZApiConnection(args: {
  instance_id: string;
  token: string;
}) {
  const base = "https://api.z-api.io";
  const instance = encodeURIComponent(args.instance_id);
  const token = encodeURIComponent(args.token);

  const candidates = [
    `${base}/instances/${instance}/token/${token}/status`,
    `${base}/instances/${instance}/token/${token}/me`,
  ];

  let lastText = "";

  for (const url of candidates) {
    // eslint-disable-next-line no-await-in-loop
    const res = await fetch(url, { method: "GET" }).catch(() => null);
    if (!res) continue;
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: true as const, url, data };
    }
    lastText = await res.text().catch(() => "");
  }

  return { ok: false as const, error: lastText || "Falha ao validar conexão na Z-API." };
}
