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

    setIsLoading(true);

    try {
      const nextRows: EnviadoRow[] = [];

      const propsAttempts = [
        (supabase as any)
          .from("properties")
          .select("*")
          .eq(propertiesAssignColumn, brokerId)
          .eq("source_type", "admin")
          .order("created_at", { ascending: false })
          .limit(200),
        (supabase as any)
          .from("properties")
          .select("*")
          .eq(propertiesAssignColumn, brokerId)
          .eq("source_type", "admin")
          .limit(200),
        (supabase as any)
          .from("properties")
          .select("*")
          .eq(propertiesAssignColumn, brokerId)
          .limit(200),
      ];

      let propsRes: any = null;
      for (const q of propsAttempts) {
        const res = await q;
        if (!res?.error) {
          propsRes = res;
          break;
        }
        propsRes = res;
        const msg = String(res.error?.message ?? "");
        const code = (res.error as any)?.code;
        const isSchemaMismatch = code === "PGRST204" || code === "PGRST301";
        const isSourceTypeMissing = /column\s+\"?source_type\"?\s+does\s+not\s+exist|source_type\s+not\s+found/i.test(msg);
        const isCreatedAtMissing = /created_at/i.test(msg);
        if (!isSchemaMismatch && !isSourceTypeMissing && !isCreatedAtMissing) break;
      }

      if (propsRes?.data) {
        for (const r of propsRes.data as Array<any>) {
          nextRows.push({ id: String(r?.id ?? ""), source: "properties", data: r });
        }
      }

      const devsAttempts = [
        (supabase as any)
          .from("developments")
          .select("*")
          .eq(developmentsAssignColumn, brokerId)
          .eq("source_type", "admin")
          .order("created_at", { ascending: false })
          .limit(200),
        (supabase as any)
          .from("developments")
          .select("*")
          .eq(developmentsAssignColumn, brokerId)
          .eq("source_type", "admin")
          .limit(200),
        (supabase as any)
          .from("developments")
          .select("*")
          .eq(developmentsAssignColumn, brokerId)
          .limit(200),
      ];

      let devsRes: any = null;
      for (const q of devsAttempts) {
        const res = await q;
        if (!res?.error) {
          devsRes = res;
          break;
        }
        devsRes = res;
        const msg = String(res.error?.message ?? "");
        const code = (res.error as any)?.code;
        const isSchemaMismatch = code === "PGRST204" || code === "PGRST301";
        const isSourceTypeMissing = /column\s+\"?source_type\"?\s+does\s+not\s+exist|source_type\s+not\s+found/i.test(msg);
        const isCreatedAtMissing = /created_at/i.test(msg);
        if (!isSchemaMismatch && !isSourceTypeMissing && !isCreatedAtMissing) break;
      }

      if (devsRes?.data) {
        for (const r of devsRes.data as Array<any>) {
          nextRows.push({ id: String(r?.id ?? ""), source: "developments", data: r });
        }
      }

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
        <div className="text-sm font-semibold text-[#dc2626]">Imóveis Enviados pelo Boss</div>
        <div className="text-xs text-zinc-600">Itens atribuídos a você para atender (com WhatsApp do proprietário).</div>
      </header>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage}</div>
      ) : null}

      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-5 py-3">
          <div className="text-sm font-semibold text-zinc-900">Lista</div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-[#1e3a8a] hover:bg-zinc-50"
          >
            Atualizar
          </button>
        </div>

        {isLoading ? (
          <div className="p-5 text-sm text-zinc-600">Carregando...</div>
        ) : rows.length === 0 ? (
          <div className="p-5 text-sm text-zinc-600">Nenhum imóvel enviado para você ainda.</div>
        ) : (
          <div className="divide-y divide-zinc-200">
            {rows.map((r) => {
              const title = pickTitle(r.source, r.data);
              const loc = pickLocation(r.source, r.data);
              const whatsapp = pickOwnerWhatsapp(r.data);
              const phoneParam = whatsapp ? encodeURIComponent(whatsapp) : "";

              return (
                <div key={`${r.source}:${r.id}`} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-zinc-900">{title}</div>
                    <div className="mt-1 text-xs text-zinc-600">
                      {r.source === "properties" ? "Imóvel" : "Empreendimento"}
                      {loc ? ` • ${loc}` : ""}
                    </div>

                    <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-zinc-700 sm:grid-cols-2">
                      {r.data?.price != null ? <div>Preço: {String(r.data.price)}</div> : null}
                      {r.data?.bedrooms != null ? <div>Quartos: {String(r.data.bedrooms)}</div> : null}
                      {r.data?.bathrooms != null ? <div>Banheiros: {String(r.data.bathrooms)}</div> : null}
                      {r.data?.area != null ? <div>Área: {String(r.data.area)}</div> : null}
                      {r.data?.address ? <div className="sm:col-span-2">Endereço: {String(r.data.address)}</div> : null}
                      {whatsapp ? <div className="sm:col-span-2">WhatsApp do proprietário: {whatsapp}</div> : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={whatsapp ? `/corretor/whatsapp?phone=${phoneParam}` : "/corretor/whatsapp"}
                      className={
                        "inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-semibold " +
                        (whatsapp
                          ? "border-zinc-200 bg-white text-[#1e3a8a] hover:bg-zinc-50"
                          : "border-zinc-100 bg-zinc-50 text-zinc-400")
                      }
                      aria-disabled={!whatsapp}
                    >
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
