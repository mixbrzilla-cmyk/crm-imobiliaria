import { NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

function normalizeWhatsapp(value: string) {
  return String(value ?? "")
    .replace(/\D+/g, "")
    .trim();
}

export async function POST(req: Request) {
  const supabase = getServiceSupabase();
  if (!supabase) {
    const hasUrl = Boolean(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
    const hasKey = Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_ROLE ||
        process.env.SUPABASE_SERVICE_KEY,
    );

    return NextResponse.json(
      {
        ok: false,
        error: "Service role não configurada.",
        missing: {
          supabaseUrl: !hasUrl,
          serviceRoleKey: !hasKey,
        },
      },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => null);
  const phone = normalizeWhatsapp(String(body?.phone ?? ""));

  if (!phone) {
    return NextResponse.json({ ok: false, error: "phone é obrigatório" }, { status: 400 });
  }

  try {
    const name = String(body?.name ?? "").trim() || "Lead WhatsApp";

    const { data: contact, error: cErr } = await (supabase as any)
      .from("contacts")
      .upsert({ phone, name }, { onConflict: "phone" })
      .select("id")
      .single();
    if (cErr) {
      return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 });
    }

    const contactId = contact?.id ? String(contact.id) : "";
    if (!contactId) {
      return NextResponse.json({ ok: false, error: "Contato inválido." }, { status: 500 });
    }

    const existing = await (supabase as any)
      .from("chat_threads")
      .select("id")
      .eq("contact_id", contactId)
      .maybeSingle();

    if (!existing.error && existing.data?.id) {
      return NextResponse.json({ ok: true, threadId: String(existing.data.id) });
    }

    const insert = await (supabase as any)
      .from("chat_threads")
      .insert({
        contact_id: contactId,
        status: "open",
        customer_phone: phone,
        contact_name: name,
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insert.error) {
      return NextResponse.json({ ok: false, error: insert.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, threadId: String(insert.data?.id ?? "") });
  } catch {
    return NextResponse.json({ ok: false, error: "Falha ao criar conversa." }, { status: 500 });
  }
}
