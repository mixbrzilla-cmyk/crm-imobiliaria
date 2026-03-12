import { NextResponse } from "next/server";

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

import { verifyClientLeadToken } from "@/lib/clientLeadAuth";

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

type Preferences = {
  lead_id: string;
  tipo_imovel: string | null;
  valor_max: number | null;
  quartos: number | null;
  bairro: string | null;
};

type BrokerProfile = {
  id: string;
  full_name: string | null;
  creci: string | null;
  avatar_url: string | null;
  regions: string[] | null;
};

export async function GET() {
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

  const cookieStore = await cookies();
  const token = cookieStore.get("client_lead")?.value ?? "";
  const payload = verifyClientLeadToken(token, tokenSecret);
  if (!payload) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const leadId = payload.lead_id;

  const leadRes = await (supabase as any)
    .from("leads")
    .select("id, full_name, phone, email, cpf, address, intent, stage, assigned_broker_profile_id")
    .eq("id", leadId)
    .maybeSingle();

  if (leadRes.error) {
    return NextResponse.json({ error: leadRes.error.message }, { status: 400 });
  }

  if (!leadRes.data) {
    return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  }

  let broker: BrokerProfile | null = null;
  try {
    const brokerId = String((leadRes.data as any)?.assigned_broker_profile_id ?? "");
    if (brokerId) {
      const brokerRes = await (supabase as any)
        .from("profiles")
        .select("id, full_name, creci, avatar_url, regions")
        .eq("id", brokerId)
        .maybeSingle();
      if (!brokerRes.error) broker = (brokerRes.data ?? null) as any;
    }
  } catch {
    broker = null;
  }

  let prefs: Preferences | null = null;
  try {
    const prefsRes = await (supabase as any)
      .from("customer_preferences")
      .select("lead_id, tipo_imovel, valor_max, quartos, bairro")
      .eq("lead_id", leadId)
      .maybeSingle();

    if (!prefsRes.error) prefs = (prefsRes.data ?? null) as any;
  } catch {
    prefs = null;
  }

  let suggestions: any[] = [];
  try {
    let q = (supabase as any)
      .from("properties")
      .select("id, title, property_type, purpose, price, neighborhood, city, bedrooms")
      .eq("status", "disponivel")
      .order("created_at", { ascending: false })
      .limit(24);

    const tipo = String(prefs?.tipo_imovel ?? "").trim();
    const bairro = String(prefs?.bairro ?? "").trim();
    const quartos = typeof prefs?.quartos === "number" ? prefs!.quartos : null;
    const valorMax = typeof prefs?.valor_max === "number" ? prefs!.valor_max : null;

    if (tipo) q = q.ilike("property_type", `%${tipo}%`);
    if (bairro) q = q.ilike("neighborhood", `%${bairro}%`);
    if (quartos != null) q = q.gte("bedrooms", quartos);
    if (valorMax != null) q = q.lte("price", valorMax);

    const sRes = await q;
    if (!sRes.error) suggestions = (sRes.data ?? []) as any[];
  } catch {
    suggestions = [];
  }

  return NextResponse.json(
    {
      lead: leadRes.data,
      preferences: prefs,
      broker,
      suggestions,
    },
    { status: 200 },
  );
}
