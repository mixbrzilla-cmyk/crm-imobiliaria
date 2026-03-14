import { NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeDigits(value: string) {
  return String(value ?? "")
    .replace(/\D+/g, "")
    .trim();
}

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
    db: { schema: "public" },
  });
}

export async function POST(req: Request) {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Service role não configurada." }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const numbers = Array.isArray(body?.numbers) ? body.numbers : [];

  const normalized = Array.from(
    new Set(
      numbers
        .map((n: any) => normalizeDigits(String(n ?? "")))
        .filter((n: string) => Boolean(n) && n.length >= 8),
    ),
  );

  if (normalized.length === 0) {
    return NextResponse.json({ ok: true, namesByNumber: {} });
  }

  const candidates = Array.from(
    new Set(
      normalized.flatMap((d) => {
        const plus = `+${d}`;
        return [d, plus];
      }),
    ),
  );

  try {
    const res = await (supabase as any)
      .from("leads")
      .select("phone, full_name")
      .in("phone", candidates)
      .limit(500);

    if (res.error) {
      return NextResponse.json({ ok: false, error: res.error.message }, { status: 500 });
    }

    const map: Record<string, string> = {};
    for (const r of (res.data ?? []) as Array<any>) {
      const phone = normalizeDigits(String(r?.phone ?? ""));
      const name = String(r?.full_name ?? "").trim();
      if (!phone || !name) continue;
      if (!map[phone]) map[phone] = name;
    }

    return NextResponse.json({ ok: true, namesByNumber: map });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Falha ao resolver nomes." }, { status: 500 });
  }
}
