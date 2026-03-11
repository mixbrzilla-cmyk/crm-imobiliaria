"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getSupabaseClient } from "@/lib/supabaseClient";

type GlobalInventoryRow = {
  id: string;
  source: "properties" | "developments";
  title: string;
  city: string;
  neighborhood: string;
  owner_whatsapp: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  status: string | null;
  role: string | null;
};

export default function CorretorHomePage() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [inventoryRows, setInventoryRows] = useState<GlobalInventoryRow[]>([]);
  const [requestingKeyId, setRequestingKeyId] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void (async () => {
        setIsLoading(true);
        setErrorMessage(null);

        if (!supabase) {
          setErrorMessage(
            "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
          );
          setProfile(null);
          setIsLoading(false);
          return;
        }

        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) {
          setErrorMessage("Sessão expirada. Faça login novamente.");
          setProfile(null);
          setIsLoading(false);
          return;
        }

        const userId = authData.user.id;
        const profRes = await supabase
          .from("profiles")
          .select("id, full_name, status, role")
          .eq("id", userId)
          .maybeSingle();

        if (profRes.error) {
          setErrorMessage(profRes.error.message);
          setProfile(null);
          setIsLoading(false);
          return;
        }

        setProfile((profRes.data ?? null) as Profile | null);
        setIsLoading(false);
      })();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, []);

  const loadInventory = useCallback(async () => {
    setInventoryLoading(true);
    setInventoryError(null);

    if (!supabase) {
      setInventoryRows([]);
      setInventoryLoading(false);
      return;
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        setInventoryRows([]);
        setInventoryLoading(false);
        return;
      }

      const propsSelect = "id, title, city, neighborhood, owner_whatsapp";
      const devsSelect = "id, name, title, city, localidade, neighborhood, owner_whatsapp";

      const [propsRes, devsRes] = await Promise.allSettled([
        supabase.from("properties").select(propsSelect).limit(50),
        (supabase as any).from("developments").select(devsSelect).limit(50),
      ]);

      const union: GlobalInventoryRow[] = [];

      if (propsRes.status === "fulfilled") {
        const value: any = propsRes.value;
        if (value?.error) {
          console.error("[Corretor Dashboard] Falha ao carregar properties", value.error);
        } else {
          const data = (value?.data ?? []) as Array<any>;
          for (const r of data) {
            union.push({
              id: String(r?.id ?? ""),
              source: "properties",
              title: String(r?.title ?? "Imóvel"),
              city: String(r?.city ?? ""),
              neighborhood: String(r?.neighborhood ?? ""),
              owner_whatsapp: String(r?.owner_whatsapp ?? ""),
            });
          }
        }
      }

      if (devsRes.status === "fulfilled") {
        const value: any = devsRes.value;
        if (value?.error) {
          console.error("[Corretor Dashboard] Falha ao carregar developments", value.error);
        } else {
          const data = (value?.data ?? []) as Array<any>;
          for (const r of data) {
            union.push({
              id: String(r?.id ?? ""),
              source: "developments",
              title: String(r?.name ?? r?.title ?? "Empreendimento"),
              city: String(r?.city ?? r?.cidade ?? ""),
              neighborhood: String(r?.localidade ?? r?.bairro ?? r?.neighborhood ?? ""),
              owner_whatsapp: String(r?.owner_whatsapp ?? ""),
            });
          }
        }
      }

      setInventoryRows(union);
      setInventoryLoading(false);
    } catch {
      setInventoryError("Não foi possível carregar o inventário global agora.");
      setInventoryRows([]);
      setInventoryLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadInventory();
    }, 0);
    return () => clearTimeout(t);
  }, [loadInventory]);

  async function requestVisitOrKey(row: GlobalInventoryRow) {
    setInventoryError(null);

    if (!supabase) {
      setInventoryError("Supabase não configurado.");
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setInventoryError("Sessão expirada. Faça login novamente.");
      return;
    }

    const brokerId = authData.user.id;
    setRequestingKeyId(`${row.source}:${row.id}`);

    try {
      try {
        await (supabase as any).from("interaction_logs").insert({
          id: crypto.randomUUID(),
          event_type: "request_visit_key",
          target_type: row.source,
          target_id: row.id,
          broker_profile_id: brokerId,
          created_at: new Date().toISOString(),
        });
      } catch {
        // ignore
      }

      try {
        await (supabase as any).from("notifications").insert({
          id: crypto.randomUUID(),
          type: "request_visit_key",
          title: "Solicitação de visita/chave",
          message: `Corretor ${profile?.full_name ?? brokerId} solicitou visita/chave: ${row.title}`,
          target_type: row.source,
          target_id: row.id,
          broker_profile_id: brokerId,
          created_at: new Date().toISOString(),
          read_at: null,
        });
      } catch {
        // ignore
      }
    } finally {
      setRequestingKeyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="text-sm font-semibold text-[#1e3a8a]">Portal do Corretor</div>
        <div className="text-xs text-zinc-500">{profile?.full_name ?? ""}</div>
      </header>

      <div>
        {isLoading ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
            Carregando...
          </div>
        ) : errorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Link
              href="/corretor/leads"
              className="rounded-xl border border-zinc-200 bg-white p-6 transition-colors hover:bg-zinc-50"
            >
              <div className="text-sm font-semibold text-[#1e3a8a]">Leads para Qualificar</div>
              <div className="mt-1 text-xs text-zinc-600">Fila enviada pelo Boss + acesso rápido ao WhatsApp.</div>
            </Link>
            <Link
              href="/corretor/inventario"
              className="rounded-xl border border-zinc-200 bg-white p-6 transition-colors hover:bg-zinc-50"
            >
              <div className="text-sm font-semibold text-[#1e3a8a]">Meu Inventário</div>
              <div className="mt-1 text-xs text-zinc-600">Cadastre captações e mande para aprovação.</div>
            </Link>
            <Link
              href="/corretor/whatsapp"
              className="rounded-xl border border-zinc-200 bg-white p-6 transition-colors hover:bg-zinc-50"
            >
              <div className="text-sm font-semibold text-[#1e3a8a]">Central WhatsApp</div>
              <div className="mt-1 text-xs text-zinc-600">Conversas auditáveis no painel do Boss.</div>
            </Link>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white">
              <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-5 py-3">
                <div className="text-sm font-semibold text-zinc-900">Inventário Global (somente leitura)</div>
                <button
                  type="button"
                  onClick={() => void loadInventory()}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-[#1e3a8a] hover:bg-zinc-50"
                >
                  Atualizar
                </button>
              </div>

              {inventoryError ? (
                <div className="p-5 text-sm text-red-700">{inventoryError}</div>
              ) : inventoryLoading ? (
                <div className="p-5 text-sm text-zinc-600">Carregando inventário...</div>
              ) : inventoryRows.length === 0 ? (
                <div className="p-5 text-sm text-zinc-600">Nenhum item encontrado.</div>
              ) : (
                <div className="divide-y divide-zinc-200">
                  {inventoryRows.slice(0, 30).map((r) => {
                    const loc = [r.neighborhood, r.city].filter(Boolean).join(" • ");
                    const key = `${r.source}:${r.id}`;
                    return (
                      <div key={key} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-zinc-900">{r.title}</div>
                          <div className="mt-1 text-xs text-zinc-600">
                            {r.source === "properties" ? "Imóvel" : "Empreendimento"}
                            {loc ? ` • ${loc}` : ""}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void requestVisitOrKey(r)}
                            disabled={requestingKeyId === key}
                            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#dc2626] px-4 text-sm font-semibold text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {requestingKeyId === key ? "Solicitando..." : "Solicitar Visita/Chave"}
                          </button>
                          <Link
                            href={r.owner_whatsapp ? `/corretor/whatsapp?phone=${encodeURIComponent(String(r.owner_whatsapp).replace(/\D+/g, "").trim())}` : "/corretor/whatsapp"}
                            className={
                              "inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-semibold " +
                              (r.owner_whatsapp
                                ? "border-zinc-200 bg-white text-[#1e3a8a] hover:bg-zinc-50"
                                : "border-zinc-100 bg-zinc-50 text-zinc-400")
                            }
                            aria-disabled={!r.owner_whatsapp}
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
        )}
      </div>
    </div>
  );
}
