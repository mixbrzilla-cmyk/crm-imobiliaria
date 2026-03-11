import { NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

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

function normalizeWhatsapp(v: string) {
  return String(v ?? "").replace(/\D+/g, "").trim();
}

export async function POST(req: Request) {
  const requiredKey =
    process.env.LEAD_RECEIVER_API_KEY ||
    process.env.NEXT_PUBLIC_LEAD_RECEIVER_API_KEY ||
    "";

  const url = new URL(req.url);
  const keyFromQuery = url.searchParams.get("api_key") ?? "";
  const keyFromHeader = req.headers.get("x-api-key") ?? req.headers.get("authorization") ?? "";
  const providedKey = (keyFromHeader.startsWith("Bearer ")
    ? keyFromHeader.slice("Bearer ".length)
    : keyFromHeader) || keyFromQuery;

  if (!requiredKey || providedKey !== requiredKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "Service role não configurada. Defina SUPABASE_SERVICE_ROLE_KEY (recomendado) no ambiente do servidor.",
      },
      { status: 500 },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const fullName = String(body?.nome ?? body?.name ?? "").trim();
  const whatsapp = normalizeWhatsapp(String(body?.whatsapp ?? body?.phone ?? body?.telefone ?? ""));
  const origin = String(body?.origem ?? body?.origin ?? body?.source ?? "").trim();
  const message = String(body?.mensagem ?? body?.message ?? "").trim();

  if (!whatsapp) {
    return NextResponse.json({ error: "whatsapp é obrigatório" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();

  try {
    const existing = await (supabase as any)
      .from("chat_threads")
      .select("id")
      .eq("external_id", whatsapp)
      .maybeSingle();

    let threadId = String(existing?.data?.id ?? "");

    if (!threadId) {
      threadId = crypto.randomUUID();

      const baseInsert: any = {
        id: threadId,
        external_id: whatsapp,
        contact_number: whatsapp,
        contact_name: fullName || null,
        status: "active",
        last_message_at: nowIso,
        assignment_status: "pending",
      };

      const insertAttempts: Array<any> = [
        {
          ...baseInsert,
          origin: origin || null,
          lead_origin: origin || null,
          last_message: message || null,
          first_message: message || null,
        },
        baseInsert,
      ];

      let lastErr: any = null;
      for (const payload of insertAttempts) {
        const res = await (supabase as any).from("chat_threads").insert(payload);
        if (!res?.error) {
          lastErr = null;
          break;
        }
        lastErr = res.error;
        const msg = String(res.error?.message ?? "");
        const code = (res.error as any)?.code;
        const isSchemaMismatch = code === "PGRST204" || code === "PGRST301";
        const isColumnMissing = /does not exist|not found/i.test(msg);
        if (!isSchemaMismatch && !isColumnMissing) break;
      }

      if (lastErr) {
        return NextResponse.json({ error: lastErr.message, details: lastErr }, { status: 400 });
      }
    } else {
      const updateBase: any = {
        last_message_at: nowIso,
        contact_number: whatsapp,
      };
      if (fullName) updateBase.contact_name = fullName;

      const updateAttempts: Array<any> = [
        { ...updateBase, assignment_status: "pending" },
        updateBase,
      ];

      let lastErr: any = null;
      for (const payload of updateAttempts) {
        const res = await (supabase as any).from("chat_threads").update(payload).eq("id", threadId);
        if (!res?.error) {
          lastErr = null;
          break;
        }
        lastErr = res.error;
        const msg = String(res.error?.message ?? "");
        const code = (res.error as any)?.code;
        const isSchemaMismatch = code === "PGRST204" || code === "PGRST301";
        const isColumnMissing = /does not exist|not found/i.test(msg);
        if (!isSchemaMismatch && !isColumnMissing) break;
      }

      if (lastErr) {
        return NextResponse.json({ error: lastErr.message, details: lastErr }, { status: 400 });
      }
    }

    try {
      await (supabase as any).from("interaction_logs").insert({
        id: crypto.randomUUID(),
        event_type: "lead_receiver_register",
        target_type: "chat_thread",
        target_id: threadId,
        created_at: nowIso,
        meta: {
          origin: origin || null,
          message: message || null,
          whatsapp,
          full_name: fullName || null,
        },
      });
    } catch {
      // ignore
    }

    try {
      if (message) {
        await (supabase as any).from("chat_messages").insert({
          id: crypto.randomUUID(),
          thread_id: threadId,
          broker_id: null,
          direction: "in",
          from_number: whatsapp,
          to_number: null,
          message,
          sent_at: nowIso,
        });
      }
    } catch {
      // ignore
    }

    return NextResponse.json({ ok: true, thread_id: threadId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Falha inesperada" }, { status: 500 });
  }
}
