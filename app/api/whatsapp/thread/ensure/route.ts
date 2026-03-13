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
    const existing = await (supabase as any)
      .from("chat_threads")
      .select("id")
      .eq("external_id", phone)
      .maybeSingle();

    if (!existing.error && existing.data?.id) {
      return NextResponse.json({ ok: true, threadId: String(existing.data.id) });
    }

    const id = crypto.randomUUID();
    const insert = await (supabase as any).from("chat_threads").insert({
      id,
      external_id: phone,
      contact_number: phone,
      contact_name: null,
      status: "active",
      last_message_at: new Date().toISOString(),
    });

    if (insert.error) {
      return NextResponse.json({ ok: false, error: insert.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, threadId: id });
  } catch {
    return NextResponse.json({ ok: false, error: "Falha ao criar conversa." }, { status: 500 });
  }
}
