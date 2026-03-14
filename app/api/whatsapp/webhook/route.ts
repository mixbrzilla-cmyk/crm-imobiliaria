import { NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  // Ignore groups to reduce noise and protect the chip
  if (remoteJid && remoteJid.includes("@g.us")) return null;

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

function extractEvolutionInstanceFromWebhook(payload: any) {
  const candidates = [
    payload?.instance,
    payload?.instanceName,
    payload?.data?.instance,
    payload?.data?.instanceName,
    payload?.data?.instance?.instanceName,
    payload?.data?.instance?.name,
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }

  return null;
}

function extractEvolutionStateFromWebhook(payload: any) {
  const candidates = [
    payload?.data?.state,
    payload?.data?.status,
    payload?.data?.connection,
    payload?.data?.connectionState,
    payload?.state,
    payload?.status,
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }

  return null;
}

function extractEvolutionInstanceApiKeyFromWebhook(payload: any) {
  const candidates = [
    payload?.data?.token,
    payload?.data?.apiKey,
    payload?.data?.apikey,
    payload?.token,
    payload?.apiKey,
    payload?.apikey,
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }

  return null;
}

function isOpenFromState(state: string | null) {
  const s = String(state ?? "")
    .trim()
    .toLowerCase();
  if (!s) return false;
  return ["open", "opened", "connected", "online"].includes(s);
}

async function persistEvolutionConnectionStatusFromWebhook(args: {
  supabase: any;
  instanceName: string | null;
  state: string | null;
  instanceApiKey: string | null;
}) {
  try {
    const res = await (args.supabase as any)
      .from("whatsapp_settings")
      .select("id, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (res?.error || !res?.data?.id) return;

    const payload: any = {
      evolution_instance_name: args.instanceName,
      evolution_instance_state: args.state,
      evolution_instance_is_open: isOpenFromState(args.state),
      evolution_instance_updated_at: new Date().toISOString(),
    };

    if (args.instanceApiKey) {
      payload.evolution_instance_api_key = args.instanceApiKey;
    }

    await (args.supabase as any)
      .from("whatsapp_settings")
      .update(payload)
      .eq("id", res.data.id);
  } catch {
    // silent
  }
}

function getServiceSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    try {
      const len =
        process.env.SUPABASE_SERVICE_ROLE_KEY?.length ??
        process.env.SUPABASE_SERVICE_ROLE?.length ??
        process.env.SUPABASE_SERVICE_KEY?.length ??
        null;
      console.log("[ServiceSupabase] missing env", {
        hasUrl: Boolean(url),
        keyLength: len,
        hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE),
        hasServiceKey: Boolean(process.env.SUPABASE_SERVICE_KEY),
      });
    } catch {
      // silent
    }
    return null;
  }

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

async function refreshThreadContactName(args: {
  supabase: any;
  threadExternalId: string;
  contactName: string | null;
}) {
  const name = safeString(args.contactName)?.trim() ?? "";
  if (!name) return;
  try {
    await args.supabase
      .from("chat_threads")
      .update({ contact_name: name })
      .eq("external_id", args.threadExternalId);
  } catch {
    // silent
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
  try {
    const supabase = getServiceSupabase();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Service role não configurada." }, { status: 500 });
    }

    const body = await req.json();
    if (body?.event !== "MESSAGES_UPSERT") return NextResponse.json({ ok: true });

    const data = body.data;
    const phone = String(data?.key?.remoteJid ?? "").split("@")[0];
    const name = data?.pushName || "Lead WhatsApp";
    const content = data?.message?.conversation || data?.message?.extendedTextMessage?.text || "";

    if (!content) return NextResponse.json({ ok: true });

    const { data: contact, error: cErr } = await (supabase as any)
      .from("contacts")
      .upsert({ phone, name }, { onConflict: "phone" })
      .select()
      .single();
    if (cErr) throw cErr;

    let { data: thread } = await (supabase as any)
      .from("chat_threads")
      .select("id")
      .eq("contact_id", contact.id)
      .maybeSingle();

    if (!thread) {
      const { data: nt, error: tErr } = await (supabase as any)
        .from("chat_threads")
        .insert({
          contact_id: contact.id,
          status: "open",
          customer_phone: phone,
          contact_name: name,
        })
        .select()
        .single();
      if (tErr) throw tErr;
      thread = nt;
    }

    const { error: mErr } = await (supabase as any).from("chat_messages").insert({
      thread_id: thread.id,
      message: content,
      direction: "in",
      from_number: phone,
      sent_at: new Date().toISOString(),
    });
    if (mErr) throw mErr;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[ERRO_CRITICO_WEBHOOK]:", err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
