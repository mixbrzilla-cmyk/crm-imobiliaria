import { NextResponse } from "next/server";

import { getSupabaseClient } from "@/lib/supabaseClient";
import { normalizeZApiWebhookPayload, verifyWhatsappWebhookClientKey } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

async function loadWhatsappSettings(supabase: any) {
  try {
    const res = await supabase
      .from("whatsapp_settings")
      .select("instance_id, token, client_key, webhook_url")
      .limit(1)
      .maybeSingle();
    if (res.error) return null;
    return res.data ?? null;
  } catch {
    return null;
  }
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
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        error: "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      },
      { status: 500 },
    );
  }

  const payload = await req.json().catch(() => null);
  const normalized = normalizeZApiWebhookPayload(payload);

  if (!normalized) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const settings = await loadWhatsappSettings(supabase);

  const receivedClientKey =
    req.headers.get("x-client-key") ??
    req.headers.get("client-key") ??
    req.headers.get("clientkey") ??
    req.headers.get("x-zapi-clientkey");

  const allowed = verifyWhatsappWebhookClientKey({
    expectedClientKey: settings?.client_key ?? null,
    receivedClientKey,
  });

  if (!allowed) {
    return NextResponse.json({ ok: false, error: "client_key inválido" }, { status: 401 });
  }

  const threadId = await ensureThread({
    supabase,
    threadExternalId: normalized.threadExternalId,
    contactNumber: normalized.fromNumber,
    contactName: normalized.contactName,
  });

  if (!threadId) {
    return NextResponse.json({ ok: true, degraded: true });
  }

  const inserted = await insertMessage({
    supabase,
    threadId,
    brokerId: null,
    direction: "in",
    fromNumber: normalized.fromNumber,
    toNumber: normalized.toNumber,
    messageText: normalized.messageText,
    timestamp: normalized.timestamp,
    raw: normalized.raw,
  });

  try {
    const phone = normalizeWhatsapp(normalized.fromNumber) || normalizeWhatsapp(normalized.toNumber);
    if (phone) {
      await touchOwnerLastContact(supabase, phone, normalized.timestamp);
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
