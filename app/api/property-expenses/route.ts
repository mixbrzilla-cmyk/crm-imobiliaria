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
  id: string;
  date: string | null;
  category: string | null;
  description: string | null;
  amount: number;
  done: boolean;
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
    let res: any = await (supabase as any)
      .from("obra_materials")
      .select("id, name, vendor, unit_price, quantity, data_compra, created_at, status, delivered_at, target_type, target_id")
      .eq("target_type", "property")
      .eq("target_id", propertyId)
      .limit(2000);

    if (res?.error) {
      const msg = String((res.error as any)?.message ?? "");
      const code = (res.error as any)?.code;
      const isSchemaMismatch = code === "PGRST204" || code === "PGRST301";
      const isDataCompraMissing = /data_compra/i.test(msg) && /does\s+not\s+exist|not\s+found/i.test(msg);
      if (isSchemaMismatch || isDataCompraMissing) {
        res = await (supabase as any)
          .from("obra_materials")
          .select("id, name, vendor, unit_price, quantity, created_at, status, delivered_at, target_type, target_id")
          .eq("target_type", "property")
          .eq("target_id", propertyId)
          .limit(2000);
      }
    }

    if (!res?.error) {
      for (const r of (res.data ?? []) as any[]) {
        const status = String(r.status ?? "").toLowerCase();
        const done = status === "entregue" || Boolean(r.delivered_at);
        const date = (r.data_compra ?? r.created_at) ?? null;
        lines.push({
          source: "materials",
          id: String(r.id),
          date,
          category: "material",
          description: String(r.name ?? "").trim() || null,
          amount: toNumber(r.unit_price) * toNumber(r.quantity),
          done,
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

        const notes = String(e.notes ?? "");
        const done = /\[(conclu[ií]do|feito|entregue)\]/i.test(notes) || /\bconclu[ií]do\b/i.test(notes);

        lines.push({
          source: "labor",
          id: String(e.id),
          date: e.entry_date ?? null,
          category: type || "labor",
          description: String(e.notes ?? "").trim() || (w?.full_name ? `Colaborador: ${w.full_name}` : null),
          amount,
          done,
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
          id: String(r.id),
          date: r.spent_at ?? null,
          category: r.category ?? null,
          description: r.description ?? null,
          amount: toNumber(r.amount),
          done: false,
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
          id: String(r.id),
          date: r.spent_at ?? null,
          category: r.category ?? null,
          description: r.description ?? null,
          amount: toNumber(r.amount),
          done: false,
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

export async function PATCH(req: Request) {
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

  const body = await req.json().catch(() => null);
  const source = String(body?.source ?? "").trim();
  const id = String(body?.id ?? "").trim();

  if (!source || !id) {
    return NextResponse.json({ ok: false, error: "source e id são obrigatórios" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();

  try {
    if (source === "materials") {
      const attempts = [
        { status: "entregue", delivered_at: nowIso },
        { status: "entregue" },
      ];

      let last: any = null;
      for (const payload of attempts) {
        // eslint-disable-next-line no-await-in-loop
        const res = await (supabase as any).from("obra_materials").update(payload).eq("id", id);
        if (!res?.error) {
          last = null;
          break;
        }
        last = res.error;
        const msg = String((res.error as any)?.message ?? "");
        const isDeliveredAtMissing = /delivered_at/i.test(msg) && /does\s+not\s+exist|not\s+found/i.test(msg);
        const code = (res.error as any)?.code;
        const isSchemaMismatch = code === "PGRST204" || code === "PGRST301";
        if (!isDeliveredAtMissing && !isSchemaMismatch) break;
      }

      if (last) return NextResponse.json({ ok: false, error: String(last.message ?? last) }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (source === "labor") {
      const res: any = await (supabase as any)
        .from("obra_worker_entries")
        .update({ done_at: nowIso })
        .eq("id", id);

      if (!res?.error) return NextResponse.json({ ok: true });

      const msg = String((res.error as any)?.message ?? "");
      const isDoneAtMissing = /done_at/i.test(msg) && /does\s+not\s+exist|not\s+found/i.test(msg);
      const code = (res.error as any)?.code;
      const isSchemaMismatch = code === "PGRST204" || code === "PGRST301";
      if (!isDoneAtMissing && !isSchemaMismatch) {
        return NextResponse.json({ ok: false, error: String(res.error.message ?? res.error) }, { status: 400 });
      }

      const getRes: any = await (supabase as any).from("obra_worker_entries").select("id, notes").eq("id", id).limit(1);
      if (getRes?.error) {
        return NextResponse.json({ ok: false, error: String(getRes.error.message ?? getRes.error) }, { status: 400 });
      }

      const current = (getRes.data ?? [])[0];
      const notes = String(current?.notes ?? "").trim();
      const next = notes ? `[CONCLUÍDO] ${notes}` : "[CONCLUÍDO]";
      const upd: any = await (supabase as any).from("obra_worker_entries").update({ notes: next }).eq("id", id);
      if (upd?.error) return NextResponse.json({ ok: false, error: String(upd.error.message ?? upd.error) }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (source === "marketing") {
      const res: any = await (supabase as any).from("marketing_expenses").update({ done_at: nowIso }).eq("id", id);
      if (!res?.error) return NextResponse.json({ ok: true });
      const msg = String((res.error as any)?.message ?? "");
      const isDoneAtMissing = /done_at/i.test(msg) && /does\s+not\s+exist|not\s+found/i.test(msg);
      const code = (res.error as any)?.code;
      const isSchemaMismatch = code === "PGRST204" || code === "PGRST301";
      if (isDoneAtMissing || isSchemaMismatch) return NextResponse.json({ ok: true });
      return NextResponse.json({ ok: false, error: String(res.error.message ?? res.error) }, { status: 400 });
    }

    if (source === "vehicle") {
      const res: any = await (supabase as any).from("vehicle_expenses").update({ done_at: nowIso }).eq("id", id);
      if (!res?.error) return NextResponse.json({ ok: true });
      const msg = String((res.error as any)?.message ?? "");
      const isDoneAtMissing = /done_at/i.test(msg) && /does\s+not\s+exist|not\s+found/i.test(msg);
      const code = (res.error as any)?.code;
      const isSchemaMismatch = code === "PGRST204" || code === "PGRST301";
      if (isDoneAtMissing || isSchemaMismatch) return NextResponse.json({ ok: true });
      return NextResponse.json({ ok: false, error: String(res.error.message ?? res.error) }, { status: 400 });
    }

    return NextResponse.json({ ok: false, error: "source inválido" }, { status: 400 });
  } catch {
    return NextResponse.json({ ok: false, error: "Não foi possível concluir este lançamento." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
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

  const body = await req.json().catch(() => null);
  const source = String(body?.source ?? "").trim();
  const id = String(body?.id ?? "").trim();

  if (!source || !id) {
    return NextResponse.json({ ok: false, error: "source e id são obrigatórios" }, { status: 400 });
  }

  try {
    const table =
      source === "materials"
        ? "obra_materials"
        : source === "labor"
          ? "obra_worker_entries"
          : source === "marketing"
            ? "marketing_expenses"
            : source === "vehicle"
              ? "vehicle_expenses"
              : null;

    if (!table) return NextResponse.json({ ok: false, error: "source inválido" }, { status: 400 });

    const res: any = await (supabase as any).from(table).delete().eq("id", id);
    if (res?.error) return NextResponse.json({ ok: false, error: String(res.error.message ?? res.error) }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Não foi possível excluir este lançamento." }, { status: 500 });
  }
}
