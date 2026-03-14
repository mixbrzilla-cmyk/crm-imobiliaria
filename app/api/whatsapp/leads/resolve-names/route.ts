import { NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeDigits(value: string) {
  return String(value ?? "")
    .replace(/\D+/g, "")
    .trim();
}

function buildCandidateDigits(digits: string) {
  const d = normalizeDigits(digits);
  if (!d) return [] as string[];
  const out = new Set<string>();
  out.add(d);
  if (d.startsWith("55") && d.length >= 12) {
    out.add(d.slice(2));
  }
  return Array.from(out);
}

function buildIlikeNeedles(digits: string) {
  const candidates = buildCandidateDigits(digits);
  const out = new Set<string>();
  for (const c of candidates) {
    if (c.length >= 8) out.add(c);
    if (c.length > 8) out.add(c.slice(-8));
    if (c.length > 9) out.add(c.slice(-9));
    if (c.length > 10) out.add(c.slice(-10));
    if (c.length > 11) out.add(c.slice(-11));
  }
  return Array.from(out);
}

function scoreMatch(targetDigits: string, leadDigits: string) {
  const t = normalizeDigits(targetDigits);
  const l = normalizeDigits(leadDigits);
  if (!t || !l) return 0;
  if (t === l) return 100;
  if (t.endsWith(l) || l.endsWith(t)) return Math.min(t.length, l.length);
  const t11 = t.length > 11 ? t.slice(-11) : t;
  const l11 = l.length > 11 ? l.slice(-11) : l;
  if (t11 === l11) return 90;
  const t10 = t.length > 10 ? t.slice(-10) : t;
  const l10 = l.length > 10 ? l.slice(-10) : l;
  if (t10 === l10) return 80;
  const t8 = t.length > 8 ? t.slice(-8) : t;
  const l8 = l.length > 8 ? l.slice(-8) : l;
  if (t8 === l8) return 70;
  return 0;
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

  const normalized: string[] = Array.from(
    new Set(
      numbers
        .map((n: any) => normalizeDigits(String(n ?? "")))
        .filter((n: string) => Boolean(n) && n.length >= 8),
    ),
  );

  if (normalized.length === 0) {
    return NextResponse.json({ ok: true, namesByNumber: {} });
  }

  try {
    const patterns: string[] = normalized
      .flatMap((d: string) => buildIlikeNeedles(d).map((n: string) => `phone.ilike.%${n}%`))
      .filter(Boolean);

    const rows: Array<any> = [];
    const chunkSize = 40;
    for (let i = 0; i < patterns.length; i += chunkSize) {
      const clause = patterns.slice(i, i + chunkSize).join(",");
      const res = await (supabase as any)
        .from("leads")
        .select("phone, full_name")
        .or(clause)
        .limit(500);
      if (res.error) {
        return NextResponse.json({ ok: false, error: res.error.message }, { status: 500 });
      }
      rows.push(...(res.data ?? []));
    }

    const namesByNumber: Record<string, string> = {};

    for (const n of normalized) {
      let bestScore = 0;
      let bestName: string | null = null;
      for (const r of rows) {
        const leadPhoneDigits = normalizeDigits(String(r?.phone ?? ""));
        const leadName = String(r?.full_name ?? "").trim();
        if (!leadPhoneDigits || !leadName) continue;
        const s = scoreMatch(n, leadPhoneDigits);
        if (s > bestScore) {
          bestScore = s;
          bestName = leadName;
        }
      }
      if (bestName) namesByNumber[n] = bestName;
    }

    return NextResponse.json({ ok: true, namesByNumber });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Falha ao resolver nomes." }, { status: 500 });
  }
}
