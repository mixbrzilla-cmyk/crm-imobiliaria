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

type ExpenseLine = {
  source: "materials" | "labor" | "marketing" | "vehicle";
  date: string | null;
  category: string | null;
  description: string | null;
  amount: number;
};

function toNumber(value: any) {
  const n = typeof value === "number" ? value : value != null ? Number(value) : 0;
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: Request) {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Service role não configurada. Defina SUPABASE_SERVICE_ROLE_KEY (recomendado) no ambiente do servidor.",
      },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(req.url);
  const propertyId = String(searchParams.get("propertyId") ?? "").trim();
  if (!propertyId) {
    return NextResponse.json({ ok: false, error: "propertyId é obrigatório" }, { status: 400 });
  }

  const lines: ExpenseLine[] = [];

  // Materiais
  try {
    const res: any = await (supabase as any)
      .from("obra_materials")
      .select("id, name, vendor, unit_price, quantity, created_at, target_type, target_id")
      .eq("target_type", "property")
      .eq("target_id", propertyId)
      .limit(2000);

    if (!res?.error) {
      for (const r of (res.data ?? []) as any[]) {
        lines.push({
          source: "materials",
          date: r.created_at ?? null,
          category: "material",
          description: String(r.name ?? "").trim() || null,
          amount: toNumber(r.unit_price) * toNumber(r.quantity),
        });
      }
    }
  } catch {
    // ignore
  }

  // Mão de obra (medições)
  try {
    const entriesRes: any = await (supabase as any)
      .from("obra_worker_entries")
      .select("id, worker_id, entry_date, entry_type, hours, notes, target_type, target_id")
      .eq("target_type", "property")
      .eq("target_id", propertyId)
      .limit(2000);

    if (!entriesRes?.error) {
      const entries = (entriesRes.data ?? []) as any[];
      const workerIds = Array.from(new Set(entries.map((e) => String(e.worker_id ?? "")).filter(Boolean)));

      const workerById = new Map<string, any>();
      if (workerIds.length > 0) {
        try {
          const workersRes: any = await (supabase as any)
            .from("obra_workers")
            .select("id, daily_rate, hourly_rate, full_name")
            .in("id", workerIds)
            .limit(2000);
          if (!workersRes?.error) {
            for (const w of (workersRes.data ?? []) as any[]) workerById.set(String(w.id), w);
          }
        } catch {
          // ignore
        }
      }

      for (const e of entries) {
        const w = workerById.get(String(e.worker_id ?? ""));
        const type = String(e.entry_type ?? "").toLowerCase();
        const amount =
          type === "diaria"
            ? toNumber(w?.daily_rate)
            : type === "hora_homem"
              ? toNumber(w?.hourly_rate) * toNumber(e.hours)
              : 0;

        lines.push({
          source: "labor",
          date: e.entry_date ?? null,
          category: type || "labor",
          description: String(e.notes ?? "").trim() || (w?.full_name ? `Colaborador: ${w.full_name}` : null),
          amount,
        });
      }
    }
  } catch {
    // ignore
  }

  // Marketing
  try {
    const res: any = await (supabase as any)
      .from("marketing_expenses")
      .select("id, spent_at, category, description, amount, target_type, target_id")
      .eq("target_type", "property")
      .eq("target_id", propertyId)
      .limit(2000);

    if (!res?.error) {
      for (const r of (res.data ?? []) as any[]) {
        lines.push({
          source: "marketing",
          date: r.spent_at ?? null,
          category: r.category ?? null,
          description: r.description ?? null,
          amount: toNumber(r.amount),
        });
      }
    }
  } catch {
    // ignore
  }

  // Veículo
  try {
    const res: any = await (supabase as any)
      .from("vehicle_expenses")
      .select("id, spent_at, category, description, amount, target_type, target_id")
      .eq("target_type", "property")
      .eq("target_id", propertyId)
      .limit(2000);

    if (!res?.error) {
      for (const r of (res.data ?? []) as any[]) {
        lines.push({
          source: "vehicle",
          date: r.spent_at ?? null,
          category: r.category ?? null,
          description: r.description ?? null,
          amount: toNumber(r.amount),
        });
      }
    }
  } catch {
    // ignore
  }

  lines.sort((a, b) => {
    const at = a.date ? new Date(a.date).getTime() : 0;
    const bt = b.date ? new Date(b.date).getTime() : 0;
    return bt - at;
  });

  return NextResponse.json({ ok: true, lines });
}
