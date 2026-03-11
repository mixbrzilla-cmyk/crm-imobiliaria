"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getSupabaseClient } from "@/lib/supabaseClient";

type Source = "properties" | "developments";

type EnviadoRow = {
  id: string;
  source: Source;
  data: any;
};

function normalizeWhatsapp(v: string) {
  return String(v ?? "").replace(/\D+/g, "").trim();
}

function pickTitle(source: Source, row: any) {
  if (source === "properties") return String(row?.title ?? row?.name ?? "Imóvel");
  return String(row?.name ?? row?.title ?? "Empreendimento");
}

function pickLocation(source: Source, row: any) {
  if (source === "properties") {
    const neighborhood = String(row?.neighborhood ?? row?.bairro ?? "");
    const city = String(row?.city ?? row?.cidade ?? "");
    return [neighborhood, city].filter(Boolean).join(" • ");
  }
  const neighborhood = String(row?.localidade ?? row?.bairro ?? row?.neighborhood ?? "");
  const city = String(row?.city ?? row?.cidade ?? "");
  return [neighborhood, city].filter(Boolean).join(" • ");
}

function pickOwnerWhatsapp(row: any) {
  return normalizeWhatsapp(String(row?.owner_whatsapp ?? row?.proprietario_whatsapp ?? row?.owner_phone ?? ""));
}

function formatCurrencyBRL(value: any) {
  const n = typeof value === "number" ? value : value != null ? Number(value) : NaN;
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pickBeds(row: any) {
  const v = row?.bedrooms ?? row?.quartos ?? null;
  const n = typeof v === "number" ? v : v != null ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function pickBaths(row: any) {
  const v = row?.bathrooms ?? row?.banheiros ?? null;
  const n = typeof v === "number" ? v : v != null ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

export default function CorretorEnviadosPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<EnviadoRow[]>([]);

  const [propertiesAssignColumn, setPropertiesAssignColumn] = useState<"assigned_broker_id" | "broker_id" | "corretor_id">(
    "assigned_broker_id",
  );
  const [developmentsAssignColumn, setDevelopmentsAssignColumn] = useState<"assigned_broker_id" | "broker_id" | "corretor_id">(
    "assigned_broker_id",
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      void (async () => {
        if (!supabase) return;

        try {
          const testAssigned = await (supabase as any).from("properties").select("id, assigned_broker_id").limit(1);
          if (!testAssigned?.error) {
            setPropertiesAssignColumn("assigned_broker_id");
          } else {
            const testBroker = await (supabase as any).from("properties").select("id, broker_id").limit(1);
            setPropertiesAssignColumn(testBroker?.error ? "corretor_id" : "broker_id");
          }
        } catch {
          setPropertiesAssignColumn("corretor_id");
        }

        try {
          const testAssigned = await (supabase as any).from("developments").select("id, assigned_broker_id").limit(1);
          if (!testAssigned?.error) {
            setDevelopmentsAssignColumn("assigned_broker_id");
          } else {
            const testBroker = await (supabase as any).from("developments").select("id, broker_id").limit(1);
            setDevelopmentsAssignColumn(testBroker?.error ? "corretor_id" : "broker_id");
          }
        } catch {
          setDevelopmentsAssignColumn("corretor_id");
        }
      })();
    }, 0);

    return () => window.clearTimeout(t);
  }, [supabase]);

  const load = useCallback(async () => {
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage("Supabase não configurado.");
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setErrorMessage("Sessão expirada. Faça login novamente.");
      return;
    }

    const brokerId = authData.user.id;

    console.log("[Corretor Enviados][DEBUG] brokerId", brokerId);

    setIsLoading(true);

    try {
      const brokerColumns: Array<"assigned_broker_id" | "broker_id" | "corretor_id"> = [
        "assigned_broker_id",
        "broker_id",
        "corretor_id",
      ];

      const union = new Map<string, EnviadoRow>();

      for (const col of brokerColumns) {
        const def = {
          table: "properties",
          filter: { column: col, value: brokerId },
          order: "created_at desc",
          limit: 300,
        };
        console.log("[Corretor Enviados][DEBUG] Query", def);

        let res: any = await (supabase as any)
          .from("properties")
          .select("*")
          .eq(col, brokerId)
          .order("created_at", { ascending: false })
          .limit(300);

        if (res?.error) {
          console.log("[Corretor Enviados][DEBUG] Query error", { def, error: res.error });
          res = await (supabase as any).from("properties").select("*").eq(col, brokerId).limit(300);
        }

        if (res?.error) {
          console.log("[Corretor Enviados][DEBUG] Query fallback error", { def, error: res.error });
          continue;
        }

        const data = (res?.data ?? []) as Array<any>;
        console.log("[Corretor Enviados][DEBUG] Query result", { def, count: data.length });

        for (const r of data) {
          const sourceType = String(r?.source_type ?? "").toLowerCase().trim();
          if (sourceType === "broker_capture") continue;
          const id = String(r?.id ?? "");
          if (!id) continue;
          union.set(`properties:${id}`, { id, source: "properties", data: r });
        }
      }

      for (const col of brokerColumns) {
        const def = {
          table: "developments",
          filter: { column: col, value: brokerId },
          order: "created_at desc",
          limit: 300,
        };
        console.log("[Corretor Enviados][DEBUG] Query", def);

        let res: any = await (supabase as any)
          .from("developments")
          .select("*")
          .eq(col, brokerId)
          .order("created_at", { ascending: false })
          .limit(300);

        if (res?.error) {
          console.log("[Corretor Enviados][DEBUG] Query error", { def, error: res.error });
          res = await (supabase as any).from("developments").select("*").eq(col, brokerId).limit(300);
        }

        if (res?.error) {
          console.log("[Corretor Enviados][DEBUG] Query fallback error", { def, error: res.error });
          continue;
        }

        const data = (res?.data ?? []) as Array<any>;
        console.log("[Corretor Enviados][DEBUG] Query result", { def, count: data.length });

        for (const r of data) {
          const sourceType = String(r?.source_type ?? "").toLowerCase().trim();
          if (sourceType === "broker_capture") continue;
          const id = String(r?.id ?? "");
          if (!id) continue;
          union.set(`developments:${id}`, { id, source: "developments", data: r });
        }
      }

      const nextRows = Array.from(union.values());
      setRows(nextRows);
      setIsLoading(false);
    } catch {
      setErrorMessage("Não foi possível carregar os imóveis enviados agora.");
      setIsLoading(false);
    }
  }, [supabase, propertiesAssignColumn, developmentsAssignColumn]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="text-sm font-semibold text-[color:var(--imob-red)]">Imóveis Enviados pela Imobiliária Moderna</div>
        <div className="text-xs text-zinc-600">Itens atribuídos a você para atender (com WhatsApp do proprietário).</div>
      </header>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage}</div>
      ) : null}

      <div className="rounded-2xl border border-zinc-200 bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-zinc-900">Seus atendimentos</div>
            <div className="mt-0.5 text-xs text-zinc-500">Cards prontos para você abrir conversa e fechar venda.</div>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-[color:var(--imob-navy)] transition-all duration-300 hover:bg-zinc-50"
          >
            Atualizar
          </button>
        </div>

        {isLoading ? (
          <div className="p-6 text-sm text-zinc-600">Carregando...</div>
        ) : rows.length === 0 ? (
          <div className="p-10">
            <div className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-2xl bg-zinc-50 p-8 text-center ring-1 ring-zinc-200">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-3xl shadow-sm ring-1 ring-zinc-200">
                🏡
              </div>
              <div className="text-base font-semibold text-zinc-900">Pronto para sua próxima venda?</div>
              <div className="text-sm text-zinc-600">Seus imóveis aparecerão aqui!</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
            {rows.map((r) => {
              const title = pickTitle(r.source, r.data);
              const loc = pickLocation(r.source, r.data);
              const whatsapp = pickOwnerWhatsapp(r.data);
              const phoneParam = whatsapp ? encodeURIComponent(whatsapp) : "";
              const priceLabel = formatCurrencyBRL(r.data?.price ?? r.data?.valor ?? null);
              const beds = pickBeds(r.data);
              const baths = pickBaths(r.data);

              return (
                <div
                  key={`${r.source}:${r.id}`}
                  className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-[1px] hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-zinc-900">{title}</div>
                      <div className="mt-1 truncate text-sm font-medium text-zinc-600">{loc || "Localização não informada"}</div>
                    </div>
                    <div className="shrink-0 rounded-full bg-[color:var(--imob-red)]/10 px-3 py-1 text-xs font-semibold text-[color:var(--imob-red)]">
                      {r.source === "properties" ? "Imóvel" : "Empreendimento"}
                    </div>
                  </div>

                  <div className="mt-4 flex items-end justify-between gap-4">
                    <div className="text-sm text-zinc-600">Preço</div>
                    <div className="text-lg font-extrabold tracking-tight text-emerald-700">{priceLabel}</div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-zinc-700">
                    {beds != null ? (
                      <div className="inline-flex items-center gap-2 rounded-full bg-zinc-50 px-3 py-1 ring-1 ring-zinc-200">
                        <span aria-hidden="true">🛏️</span>
                        <span className="font-semibold">{beds}</span>
                      </div>
                    ) : null}
                    {baths != null ? (
                      <div className="inline-flex items-center gap-2 rounded-full bg-zinc-50 px-3 py-1 ring-1 ring-zinc-200">
                        <span aria-hidden="true">🚿</span>
                        <span className="font-semibold">{baths}</span>
                      </div>
                    ) : null}
                    {r.data?.area != null ? (
                      <div className="inline-flex items-center gap-2 rounded-full bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
                        {String(r.data.area)} m²
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs font-medium text-zinc-500">
                      {whatsapp ? `WhatsApp do proprietário: ${whatsapp}` : "WhatsApp não informado"}
                    </div>
                    <Link
                      href={whatsapp ? `/corretor/whatsapp?phone=${phoneParam}` : "/corretor/whatsapp"}
                      className={
                        "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-sm transition-all duration-300 " +
                        (whatsapp
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : "bg-zinc-100 text-zinc-400")
                      }
                      aria-disabled={!whatsapp}
                    >
                      <span aria-hidden="true">💬</span>
                      WhatsApp
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
