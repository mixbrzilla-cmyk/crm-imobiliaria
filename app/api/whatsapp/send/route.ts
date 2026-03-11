import { NextResponse } from "next/server";

import { getSupabaseClient } from "@/lib/supabaseClient";
import { sendZApiTextMessage } from "@/lib/whatsapp";

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

  const body = await req.json().catch(() => null);
  const phone = (body?.phone ?? "").toString().trim();
  const message = (body?.message ?? "").toString();
  const threadId = (body?.thread_id ?? "").toString().trim();
  const brokerId = body?.broker_id ? String(body.broker_id) : null;
  const asBoss = Boolean(body?.as_boss);

  if (!phone || !message) {
    return NextResponse.json({ ok: false, error: "phone e message são obrigatórios" }, { status: 400 });
  }

  const settings = await loadWhatsappSettings(supabase);
  if (!settings?.instance_id || !settings?.token) {
    return NextResponse.json(
      {
        ok: false,
        error: "Z-API não configurada. Preencha a tela de Configuração do WhatsApp.",
      },
      { status: 400 },
    );
  }

  try {
    const apiRes = await sendZApiTextMessage({
      settings,
      phone,
      message,
    });

    if (threadId) {
      try {
        await supabase.from("chat_messages").insert({
          id: crypto.randomUUID(),
          thread_id: threadId,
          broker_id: asBoss ? null : brokerId,
          direction: "out",
          from_number: null,
          to_number: phone,
          message,
          sent_at: new Date().toISOString(),
          raw_payload: apiRes,
        });

        await supabase
          .from("chat_threads")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", threadId);
      } catch {
        // silent
      }
    }

    return NextResponse.json({ ok: true, data: apiRes });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message ?? "Falha ao enviar mensagem.",
      },
      { status: 500 },
    );
  }
}
