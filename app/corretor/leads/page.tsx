"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getSupabaseClient } from "@/lib/supabaseClient";

type LeadRow = {
  id: string;
  full_name: string;
  phone: string;
  interest: string | null;
  stage: string | null;
  source: string | null;
  assigned_broker_profile_id: string | null;
  created_at?: string;
};

function normalizePhone(value: string) {
  return String(value ?? "").replace(/\D+/g, "").trim();
}

export default function CorretorLeadsPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<LeadRow[]>([]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void (async () => {
        setIsLoading(true);
        setErrorMessage(null);

        if (!supabase) {
          setErrorMessage(
            "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
          );
          setRows([]);
          setIsLoading(false);
          return;
        }

        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) {
          setErrorMessage("Sessão expirada. Faça login novamente.");
          setRows([]);
          setIsLoading(false);
          return;
        }

        const brokerId = authData.user.id;

        const rich = await supabase
          .from("leads")
          .select("id, full_name, phone, interest, stage, source, assigned_broker_profile_id, created_at")
          .eq("assigned_broker_profile_id", brokerId)
          .order("created_at", { ascending: false });

        if (rich.error) {
          setErrorMessage(rich.error.message);
          setRows([]);
          setIsLoading(false);
          return;
        }

        setRows((rich.data ?? []) as LeadRow[]);
        setIsLoading(false);
      })();
    }, 0);

    return () => window.clearTimeout(t);
  }, [supabase]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="text-sm font-semibold text-[color:var(--imob-navy)]">Leads para Qualificar</div>
        <div className="text-xs text-zinc-500">Proprietários vindos de landing pages ou enviados pela Imobiliária Moderna.</div>
      </header>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage}</div>
      ) : null}

      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-5 py-3">
          <div className="text-sm font-semibold text-zinc-900">Fila</div>
          <Link
            href="/corretor/whatsapp"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-[color:var(--imob-navy)] hover:bg-zinc-50"
          >
            Abrir Central WhatsApp
          </Link>
        </div>

        {isLoading ? (
          <div className="p-5 text-sm text-zinc-600">Carregando...</div>
        ) : rows.length === 0 ? (
          <div className="p-5 text-sm text-zinc-600">Nenhum lead atribuído a você no momento.</div>
        ) : (
          <div className="divide-y divide-zinc-200">
            {rows.map((r) => {
              const phone = normalizePhone(r.phone);
              return (
                <div key={r.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-zinc-900">{r.full_name}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
                      <span>{r.phone}</span>
                      {r.interest ? <span>• {r.interest}</span> : null}
                      {r.source ? <span>• origem: {r.source}</span> : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={phone ? `/corretor/whatsapp?phone=${encodeURIComponent(phone)}` : "/corretor/whatsapp"}
                      className={
                        "inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold " +
                        (phone
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : "bg-zinc-100 text-zinc-500")
                      }
                      aria-disabled={!phone}
                    >
                      WhatsApp
                    </Link>
                    <Link
                      href="/corretor/inventario"
                      className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-[color:var(--imob-navy)] hover:bg-zinc-50"
                    >
                      Cadastrar captação
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
