import { NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

import { signClientLeadToken } from "@/lib/clientLeadAuth";

 export const runtime = "nodejs";
 export const dynamic = "force-dynamic";

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
    db: { schema: "public" },
  });
}

function normalizeDigits(v: string) {
  return String(v ?? "").replace(/\D+/g, "").trim();
}

function normalizeEmail(v: string) {
  return String(v ?? "").trim().toLowerCase();
}

export async function POST(req: Request) {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service role não configurada. Defina SUPABASE_SERVICE_ROLE_KEY no ambiente do servidor." },
      { status: 500 },
    );
  }

  const tokenSecret = process.env.CLIENT_LEAD_TOKEN_SECRET || "";
  if (!tokenSecret) {
    return NextResponse.json(
      { error: "CLIENT_LEAD_TOKEN_SECRET não configurado no ambiente do servidor." },
      { status: 500 },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const mode = String(body?.mode ?? "cpf").trim();
  const cpf = normalizeDigits(String(body?.cpf ?? ""));
  const email = normalizeEmail(String(body?.email ?? ""));
  const phone = normalizeDigits(String(body?.phone ?? ""));

  if (!phone) return NextResponse.json({ error: "Telefone é obrigatório" }, { status: 400 });

  const query = (supabase as any)
    .from("leads")
    .select("id")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(1);

  if (mode === "email") {
    if (!email) return NextResponse.json({ error: "E-mail é obrigatório" }, { status: 400 });
    query.eq("email", email);
  } else {
    if (!cpf) return NextResponse.json({ error: "CPF é obrigatório" }, { status: 400 });
    query.eq("cpf", cpf);
  }

  const res = await query.maybeSingle();
  if (res.error) {
    return NextResponse.json({ error: res.error.message }, { status: 400 });
  }

  const leadId = String(res.data?.id ?? "");
  if (!leadId) {
    return NextResponse.json({ error: "Cadastro não encontrado. Verifique os dados informados." }, { status: 404 });
  }

  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  const token = signClientLeadToken({ lead_id: leadId, exp }, tokenSecret);

  const secure = process.env.NODE_ENV === "production";
  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    `client_lead=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7};${secure ? " Secure;" : ""}`,
  );

  return NextResponse.json({ ok: true }, { status: 200, headers });
}
