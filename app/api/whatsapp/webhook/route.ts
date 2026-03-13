import { NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function safeString(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return null;
}

function normalizeEventName(raw: unknown) {
  const v = safeString(raw);
  if (!v) return null;
  const upper = v.replace(/[.\-\s]+/g, "_").toUpperCase();
  return upper;
}

function jidToPhone(jid: string | null) {
  const raw = String(jid ?? "");
  const beforeAt = raw.includes("@") ? raw.split("@")[0] : raw;
  const digits = beforeAt.replace(/\D+/g, "").trim();
  return digits || null;
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

type EvolutionWebhookEvent = {
  kind: "event";
  event: string;
  raw: unknown;
};

type EvolutionWebhookMessage = {
  kind: "message";
  event: "MESSAGES_UPSERT";
  threadExternalId: string;
  fromNumber: string | null;
  toNumber: string | null;
  messageText: string;
  timestamp: string;
  contactName: string | null;
  direction: "in" | "out";
  raw: unknown;
};

function normalizeEvolutionWebhookPayload(payload: any): EvolutionWebhookEvent | EvolutionWebhookMessage | null {
  if (!payload || typeof payload !== "object") return null;

  const event = normalizeEventName(payload?.event ?? payload?.type ?? payload?.data?.event);
  if (!event) return null;
  if (event !== "MESSAGES_UPSERT") return { kind: "event", event, raw: payload };

  const data = payload?.data ?? payload;
  const msgContainer = data?.messages ?? data?.message ?? data;
  const msg = Array.isArray(msgContainer) ? msgContainer[0] : msgContainer;

  const key = msg?.key ?? data?.key ?? {};
  const remoteJid = safeString(key?.remoteJid) ?? safeString(data?.remoteJid);
  const fromMe = Boolean(key?.fromMe ?? data?.fromMe);
  const message = msg?.message ?? data?.message ?? msg;

  const phone = jidToPhone(remoteJid);
  if (!phone) return null;

  const timestampRaw = safeString(msg?.messageTimestamp ?? data?.messageTimestamp ?? msg?.timestamp ?? data?.timestamp);
  const iso = timestampRaw && /^\d+$/.test(timestampRaw)
    ? new Date(Number(timestampRaw) * 1000).toISOString()
    : timestampRaw || new Date().toISOString();

  const text = extractTextFromMessage(message);
  if (!text) return null;

  return {
    kind: "message",
    event,
    threadExternalId: phone,
    fromNumber: fromMe ? null : phone,
    toNumber: fromMe ? phone : null,
    messageText: text,
    timestamp: iso,
    contactName: safeString(data?.pushName ?? data?.senderName ?? msg?.pushName ?? msg?.senderName) ?? null,
    direction: fromMe ? ("out" as const) : ("in" as const),
    raw: payload,
  };
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

function normalizeWhatsapp(value: string | null) {
  return String(value ?? "")
    .replace(/\D+/g, "")
    .trim();
}

async function touchOwnerLastContact(supabase: any, phone: string, iso: string) {
  try {
    await Promise.all([
      (supabase as any).from("properties").update({ last_owner_contact_at: iso }).eq("owner_whatsapp", normalizeWhatsapp(phone)),
      (supabase as any).from("developments").update({ last_owner_contact_at: iso }).eq("owner_whatsapp", normalizeWhatsapp(phone)),
    ]);
  } catch {
    // silent
  }
}

async function ensureThread(args: {
  supabase: any;
  threadExternalId: string;
  contactNumber: string | null;
  contactName: string | null;
}) {
  try {
    const existing = await args.supabase
      .from("chat_threads")
      .select("id")
      .eq("external_id", args.threadExternalId)
      .maybeSingle();

    if (!existing.error && existing.data?.id) return existing.data.id as string;

    const id = crypto.randomUUID();
    const insert = await args.supabase.from("chat_threads").insert({
      id,
      external_id: args.threadExternalId,
      contact_number: args.contactNumber,
      contact_name: args.contactName,
      status: "active",
      last_message_at: new Date().toISOString(),
    });

    if (insert.error) return null;
    return id;
  } catch {
    return null;
  }
}

async function insertMessage(args: {
  supabase: any;
  threadId: string;
  brokerId: string | null;
  direction: "in" | "out";
  fromNumber: string | null;
  toNumber: string | null;
  messageText: string;
  timestamp: string;
  raw: unknown;
}) {
  try {
    const res = await args.supabase.from("chat_messages").insert({
      id: crypto.randomUUID(),
      thread_id: args.threadId,
      broker_id: args.brokerId,
      direction: args.direction,
      from_number: args.fromNumber,
      to_number: args.toNumber,
      message: args.messageText,
      sent_at: args.timestamp,
      raw_payload: args.raw,
    });
    return !res.error;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Service role não configurada." }, { status: 500 });
  }

  const payload = await req.json().catch(() => null);
  const normalized = normalizeEvolutionWebhookPayload(payload);

  if (!normalized) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (normalized.kind === "event") {
    try {
      console.log("[WhatsApp Webhook] CONNECTION_UPDATE/other event:", {
        event: normalized.event,
        instance: payload?.instance ?? payload?.data?.instance ?? payload?.data?.instanceName ?? null,
        status: payload?.data?.state ?? payload?.data?.status ?? payload?.data?.connection ?? payload?.data?.connectionState ?? null,
      });
    } catch {
      // silent
    }

    return NextResponse.json({ ok: true, event: normalized.event, ignored: true });
  }

  // From here on it's a message payload
  const msg = normalized;

  const threadId = await ensureThread({
    supabase,
    threadExternalId: msg.threadExternalId,
    contactNumber: msg.fromNumber,
    contactName: msg.contactName,
  });

  if (!threadId) {
    return NextResponse.json({ ok: true, degraded: true });
  }

  const inserted = await insertMessage({
    supabase,
    threadId,
    brokerId: null,
    direction: msg.direction,
    fromNumber: msg.fromNumber,
    toNumber: msg.toNumber,
    messageText: msg.messageText,
    timestamp: msg.timestamp,
    raw: msg.raw,
  });

  try {
    const phone = normalizeWhatsapp(msg.fromNumber) || normalizeWhatsapp(msg.toNumber);
    if (phone) {
      await touchOwnerLastContact(supabase, phone, msg.timestamp);
    }
  } catch {
    // silent
  }

  try {
    await supabase
      .from("chat_threads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", threadId);
  } catch {
    // silent
  }

  return NextResponse.json({ ok: true, inserted });
}
