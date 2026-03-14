import { NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

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

async function loadEvolutionSettings() {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return {
      ok: false as const,
      error:
        "Service role não configurada. Defina SUPABASE_SERVICE_ROLE_KEY no ambiente do servidor para bypass do RLS.",
    };
  }

  const res = await (supabase as any)
    .from("whatsapp_settings")
    .select("evolution_api_url, evolution_global_api_key, evolution_instance_api_key, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (res.error) {
    return { ok: false as const, error: res.error.message };
  }

  const dbApiUrl = String((res.data as any)?.evolution_api_url ?? "").trim();
  const dbApiKey = String((res.data as any)?.evolution_global_api_key ?? "").trim();
  const envApiUrl = String(
    process.env.EVOLUTION_API_URL ??
      process.env.EVOLUTION_BASE_URL ??
      process.env.EVOLUTION_URL ??
      "",
  ).trim();
  const envApiKey = String(
    process.env.EVOLUTION_API_KEY ?? process.env.EVOLUTION_GLOBAL_API_KEY ?? "",
  ).trim();
  const apiUrl = envApiUrl || dbApiUrl;
  const apiKey = envApiKey || dbApiKey;

  const dbInstanceApiKey = String((res.data as any)?.evolution_instance_api_key ?? "").trim();
  const envInstanceApiKey = String(process.env.EVOLUTION_INSTANCE_API_KEY ?? "").trim();
  const instanceApiKey = envInstanceApiKey || dbInstanceApiKey;

  const effectiveApiKey = instanceApiKey || apiKey;

  if (!apiUrl || !effectiveApiKey) {
    return {
      ok: false as const,
      error: "Evolution não configurada. Preencha URL e Global API Key no Painel WhatsApp.",
    };
  }

  return {
    ok: true as const,
    apiUrl,
    apiKey: effectiveApiKey,
    globalApiKey: apiKey,
    instanceApiKey,
    supabase,
  };
}

function buildAuthHeaders(globalKey: string) {
  return {
    apikey: globalKey,
    "x-api-key": globalKey,
    "X-Api-Key": globalKey,
    Authorization: `Bearer ${globalKey}`,
    "Content-Type": "application/json",
  } as Record<string, string>;
}

function normalizeWhatsapp(value: string) {
  return String(value ?? "")
    .replace(/\D+/g, "")
    .trim();
}

async function ensureThreadForPhone(supabase: any, phone: string) {
  const normalized = normalizeWhatsapp(phone);
  if (!normalized) return null;

  const name = "Lead WhatsApp";

  try {
    const { data: contact, error: cErr } = await (supabase as any)
      .from("contacts")
      .upsert({ phone: normalized, name }, { onConflict: "phone" })
      .select("id")
      .single();
    if (cErr) return null;
    const contactId = contact?.id ? String(contact.id) : "";
    if (!contactId) return null;

    const existing = await (supabase as any)
      .from("chat_threads")
      .select("id")
      .eq("contact_id", contactId)
      .maybeSingle();

    if (!existing.error && existing.data?.id) return String(existing.data.id);

    const insert = await (supabase as any)
      .from("chat_threads")
      .insert({
        contact_id: contactId,
        status: "open",
        customer_phone: normalized,
        contact_name: name,
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insert.error) return null;
    return insert.data?.id ? String(insert.data.id) : null;
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomInt(min: number, max: number) {
  const a = Math.ceil(min);
  const b = Math.floor(max);
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

async function safeSendComposingPresence(baseUrl: URL, headers: Record<string, string>, instanceName: string, phone: string) {
  const number = normalizeWhatsapp(phone);
  if (!number) return;
  try {
    const url = new URL(`/chat/sendPresence/${instanceName}`, baseUrl).toString();
    await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        number,
        options: {
          delay: 0,
          presence: "composing",
          number,
        },
      }),
      cache: "no-store",
    });
  } catch {
    // ignore
  }
}

async function touchOwnerLastContact(supabase: any, phone: string, iso: string) {
  const normalized = normalizeWhatsapp(phone);
  if (!normalized) return;
  try {
    await Promise.all([
      (supabase as any).from("properties").update({ last_owner_contact_at: iso }).eq("owner_whatsapp", normalized),
      (supabase as any).from("developments").update({ last_owner_contact_at: iso }).eq("owner_whatsapp", normalized),
    ]);
  } catch {
    // silent
  }
}

export async function POST(req: Request) {
  const settings = await loadEvolutionSettings();
  if (!settings.ok) {
    return NextResponse.json({ ok: false, error: settings.error }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const phone = (body?.phone ?? "").toString().trim();
  const message = (body?.message ?? "").toString();
  const threadIdRaw = (body?.thread_id ?? "").toString().trim();
  const brokerId = body?.broker_id ? String(body.broker_id) : null;
  const asBoss = Boolean(body?.as_boss);

  if (!phone || !message) {
    return NextResponse.json({ ok: false, error: "phone e message são obrigatórios" }, { status: 400 });
  }

  const baseUrl = toAbsoluteBaseUrl(settings.apiUrl);
  if (!baseUrl) {
    return NextResponse.json({ ok: false, error: "URL da Evolution inválida." }, { status: 400 });
  }

  const instanceName = "boss_imob";
  const headers = buildAuthHeaders(settings.apiKey);

  try {
    const nowIso = new Date().toISOString();
    const ensuredThreadId = threadIdRaw || (await ensureThreadForPhone((settings as any).supabase, phone));

    await safeSendComposingPresence(baseUrl, headers, instanceName, phone);
    await sleep(2000);
    await sleep(randomInt(3000, 7000));
    const url = new URL(`/message/sendText/${instanceName}`, baseUrl).toString();
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        number: normalizeWhatsapp(phone),
        text: message,
        textMessage: {
          text: message,
        },
      }),
      cache: "no-store",
    });

    const apiText = await res.text().catch(() => "");
    let apiRes: any = null;
    try {
      apiRes = apiText ? JSON.parse(apiText) : null;
    } catch {
      apiRes = apiText;
    }

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Falha ao enviar mensagem. HTTP ${res.status}. ${apiText}` },
        { status: 502 },
      );
    }

    if (ensuredThreadId) {
      try {
        await (settings as any).supabase.from("chat_messages").insert({
          id: crypto.randomUUID(),
          thread_id: ensuredThreadId,
          broker_id: asBoss ? null : brokerId,
          direction: "out",
          from_number: null,
          to_number: phone,
          message,
          sent_at: nowIso,
          raw_payload: apiRes,
        });

        await (settings as any).supabase
          .from("chat_threads")
          .update({ last_message_at: nowIso })
          .eq("id", ensuredThreadId);
      } catch {
        // silent
      }
    }

    try {
      await touchOwnerLastContact((settings as any).supabase, phone, new Date().toISOString());
    } catch {
      // silent
    }

    return NextResponse.json({ ok: true, data: apiRes, threadId: ensuredThreadId || null });
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
