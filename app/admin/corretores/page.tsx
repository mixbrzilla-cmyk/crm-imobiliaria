"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { MessageCircle, Trash2 } from "lucide-react";

import { getSupabaseClient } from "@/lib/supabaseClient";

type BrokerProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string | null;
  role?: string | null;
};

type BrokerRowView = {
  id: string;
  full_name: string;
  email: string;
  statusLabel: string;
  isActive: boolean;
  propertiesInHands: number;
  assignedProperties: Array<{
    id: string;
    title: string;
    purpose: string | null;
    data_direcionamento: string | null;
    clicks: number;
  }>;
  whatsClicks: number;
};

function normalizePurpose(purpose: string | null) {
  const p = (purpose ?? "").toLowerCase().trim();
  if (p.includes("loc") || p.includes("alug")) return "locacao";
  return "venda";
}

function purposeBadgeCls(purpose: string | null) {
  const p = normalizePurpose(purpose);
  if (p === "locacao") return "bg-emerald-50 text-emerald-700 ring-emerald-200/70";
  return "bg-sky-50 text-sky-700 ring-sky-200/70";
}

function purposeLabel(purpose: string | null) {
  return normalizePurpose(purpose) === "locacao" ? "Locação" : "Venda";
}

function statusBadge(status: string | null) {
  const s = (status ?? "").toLowerCase().trim();
  const active = s === "ativo" || s === "aprovado";
  return {
    label: status ?? "-",
    active,
  };
}

export default function CorretoresAdminPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [rows, setRows] = useState<BrokerRowView[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadBaseData = useCallback(async () => {
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

    const brokersRes = await supabase
      .from("profiles")
      .select("id, full_name, email, status, role")
      .eq("role", "broker")
      .order("full_name", { ascending: true });

    if (brokersRes.error) {
      setErrorMessage(brokersRes.error.message);
      setIsLoading(false);
      return;
    }
    const brokerRows = (brokersRes.data ?? []) as BrokerProfile[];
    const brokerIds = brokerRows.map((b) => b.id);

    const propsByBroker = new Map<string, BrokerRowView["assignedProperties"]>();
    const whatsClicksByBroker = new Map<string, number>();

    function addClicks(brokerId: string, value: unknown) {
      const v = typeof value === "number" ? value : Number(value ?? 0);
      if (!Number.isFinite(v)) return;
      whatsClicksByBroker.set(brokerId, (whatsClicksByBroker.get(brokerId) ?? 0) + v);
    }

    const clickColumnsToTry = [
      "whatsapp_clicks",
      "whats_clicks",
      "clicks_whatsapp",
      "whatsapp_click_count",
    ];

    let propertiesClickColumn: string | null = null;
    for (const col of clickColumnsToTry) {
      const test = await supabase.from("properties").select(`id, corretor_id, ${col}`).limit(1);
      if (!test.error) {
        propertiesClickColumn = col;
        break;
      }
    }

    const propsSelect = propertiesClickColumn
      ? `id, title, purpose, corretor_id, data_direcionamento, ${propertiesClickColumn}`
      : "id, title, purpose, corretor_id, data_direcionamento";

    const propsRes = brokerIds.length
      ? await supabase
          .from("properties")
          .select(propsSelect)
          .in("corretor_id", brokerIds)
          .not("corretor_id", "is", null)
          .order("data_direcionamento", { ascending: false })
      : { data: [], error: null };

    if (propsRes.error) {
      setErrorMessage(propsRes.error.message);
      setRows([]);
      setIsLoading(false);
      return;
    }

    const props = (propsRes.data ?? []) as Array<any>;
    for (const row of props) {
      const brokerId = String(row?.corretor_id ?? "").trim();
      if (!brokerId) continue;

      const title = String(row?.title ?? "").trim() || "-";
      const purpose = (row?.purpose ?? null) as string | null;
      const directedAt = (row?.data_direcionamento ?? null) as string | null;
      const clicksRaw = propertiesClickColumn ? row?.[propertiesClickColumn] : 0;
      const clicks = typeof clicksRaw === "number" ? clicksRaw : Number(clicksRaw ?? 0);
      const safeClicks = Number.isFinite(clicks) ? clicks : 0;

      const list = propsByBroker.get(brokerId) ?? [];
      list.push({
        id: String(row?.id ?? crypto.randomUUID()),
        title,
        purpose,
        data_direcionamento: directedAt,
        clicks: safeClicks,
      });
      propsByBroker.set(brokerId, list);
      addClicks(brokerId, safeClicks);
    }

    const view: BrokerRowView[] = brokerRows.map((b) => {
      const name = (b.full_name ?? "").trim() || "-";
      const email = (b.email ?? "").trim() || "-";
      const status = statusBadge(b.status ?? null);
      const assignedProperties = propsByBroker.get(b.id) ?? [];
      const inHands = assignedProperties.length;
      const clicks = whatsClicksByBroker.get(b.id) ?? 0;
      return {
        id: b.id,
        full_name: name,
        email,
        statusLabel: status.label,
        isActive: status.active,
        propertiesInHands: inHands,
        assignedProperties,
        whatsClicks: clicks,
      };
    });

    setRows(view);
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadBaseData();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [loadBaseData]);

  async function deleteBroker(brokerId: string) {
    setErrorMessage(null);
    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    const brokerName = (rows.find((r) => r.id === brokerId)?.full_name ?? "").trim() || brokerId;
    const ok = window.confirm(
      `Excluir o corretor "${brokerName}"? Isso vai remover o perfil e liberar os imóveis atribuídos.`,
    );
    if (!ok) return;

    setDeletingId(brokerId);
    try {
      const releaseProps = await supabase
        .from("properties")
        .update({ corretor_id: null, data_direcionamento: null })
        .eq("corretor_id", brokerId);

      if (releaseProps.error) {
        setErrorMessage(releaseProps.error.message);
        return;
      }

      const delProfile = await supabase.from("profiles").delete().eq("id", brokerId);
      if (delProfile.error) {
        setErrorMessage(delProfile.error.message);
        return;
      }

      await loadBaseData();
    } catch {
      setErrorMessage("Não foi possível excluir o corretor agora.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">GESTÃO DE CORRETORES</div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Performance & Carteira</h1>
      </header>

      {errorMessage ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-sm font-semibold text-slate-900">Corretores</div>
            <div className="mt-1 text-xs text-slate-500">
              Cards de performance com carteira e cliques no WhatsApp.
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadBaseData()}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-slate-900 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50"
          >
            Recarregar
          </button>
        </div>

        {isLoading ? (
          <div className="mt-6 rounded-2xl bg-slate-50 px-5 py-6 text-sm text-slate-600 ring-1 ring-slate-200/70">
            Carregando...
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-6 rounded-2xl bg-slate-50 px-5 py-6 text-sm text-slate-600 ring-1 ring-slate-200/70">
            Nenhum corretor encontrado.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {rows.map((r) => {
              return (
                <div
                  key={r.id}
                  className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-base font-semibold text-slate-900">{r.full_name}</div>
                      <div className="mt-1 text-sm text-slate-600">{r.email}</div>
                      <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70">
                        <span
                          className={
                            "h-2 w-2 rounded-full " +
                            (r.isActive
                              ? "bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.15)] animate-pulse"
                              : "bg-slate-300")
                          }
                        />
                        {r.statusLabel}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void deleteBroker(r.id)}
                      disabled={deletingId === r.id}
                      className="inline-flex h-11 items-center justify-center rounded-xl bg-[#dc2626] px-4 text-sm font-semibold text-white shadow-[0_6px_14px_-10px_rgba(220,38,38,0.55)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#b91c1c] disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label="Excluir corretor"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200/70">
                      <div className="text-xs font-semibold tracking-wide text-slate-600">Imóveis em mãos</div>
                      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                        {r.propertiesInHands}
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200/70">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold tracking-wide text-slate-600">Performance (Whats)</div>
                        <MessageCircle className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                        {r.whatsClicks}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="text-xs font-semibold tracking-wide text-slate-600">Carteira</div>
                    <div className="mt-3 flex flex-col gap-2">
                      {r.assignedProperties.length > 0 ? (
                        r.assignedProperties.slice(0, 18).map((p) => (
                          <div
                            key={p.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200/70"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={
                                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 " +
                                  purposeBadgeCls(p.purpose)
                                }
                              >
                                {purposeLabel(p.purpose)}
                              </span>
                              <div className="text-sm font-semibold text-slate-900">{p.title}</div>
                            </div>

                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              <div>
                                {p.data_direcionamento
                                  ? new Date(p.data_direcionamento).toLocaleDateString("pt-BR")
                                  : "Aguardando registro"}
                              </div>
                              {p.clicks > 0 ? (
                                <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700 ring-1 ring-emerald-200/70">
                                  <MessageCircle className="h-3.5 w-3.5" />
                                  {p.clicks}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl bg-slate-50 px-5 py-5 text-sm text-slate-600 ring-1 ring-slate-200/70">
                          Nenhum imóvel atribuído.
                        </div>
                      )}
                      {r.assignedProperties.length > 18 ? (
                        <div className="text-xs font-semibold text-slate-500">
                          +{r.assignedProperties.length - 18} imóveis não exibidos
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
