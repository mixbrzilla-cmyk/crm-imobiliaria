"use client";

import Link from "next/link";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getSupabaseClient } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  full_name: string | null;
  whatsapp: string | null;
  creci: string | null;
  status: string | null;
  role?: string | null;
  status_aprovacao?: string | null;
};

type LeadSource = "meta" | "google" | "whatsapp" | "portais" | "landing" | "outros";

type LeadRow = {
  id: string;
  source: string | null;
  created_at?: string;
};

type TopProperty = {
  id: string;
  property_type: string;
  purpose: string;
  price: number | null;
  address: string | null;
};

type ObraMaterialRow = {
  id: string;
  status: string | null;
  unit_price: number | null;
  quantity: number | null;
};

type WhatsActivityLine = {
  brokerName: string;
  leadLabel: string;
  count: number;
  threadId: string;
};

function formatCurrencyBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function normalizeLeadSource(input: string | null): LeadSource {
  const value = (input ?? "").trim().toLowerCase();
  if (!value) return "outros";
  if (value.includes("meta") || value.includes("facebook") || value.includes("instagram")) {
    return "meta";
  }
  if (value.includes("google") || value.includes("gads") || value.includes("adwords")) {
    return "google";
  }
  if (value.includes("whats")) return "whatsapp";
  if (value.includes("portal")) return "portais";
  if (value.includes("landing") || value.includes("lp")) return "landing";
  return "outros";
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);

  const width = 140;
  const height = 36;

  const points = values
    .map((v, idx) => {
      const x = values.length === 1 ? 0 : (idx / (values.length - 1)) * width;
      const y = ((max - v) / (max - min || 1)) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="text-slate-900"
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.75"
        points={points}
      />
    </svg>
  );
}

export default function AdminDashboardClient() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [rows, setRows] = useState<Profile[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [propertiesCount, setPropertiesCount] = useState<number>(0);

  const [carteiraByBrokerId, setCarteiraByBrokerId] = useState<Record<string, number>>({});
  const [totalImoveisCount, setTotalImoveisCount] = useState<number>(0);
  const [assignedImoveisCount, setAssignedImoveisCount] = useState<number>(0);
  const [unassignedImoveisCount, setUnassignedImoveisCount] = useState<number>(0);

  const [obraMaterialsTotal, setObraMaterialsTotal] = useState<number>(0);
  const [obraPendingDeliveries, setObraPendingDeliveries] = useState<number>(0);

  const [leadsTodayCount, setLeadsTodayCount] = useState<number>(0);
  const [leadsWeekCount, setLeadsWeekCount] = useState<number>(0);
  const [leadsWeekTrend, setLeadsWeekTrend] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [vgvValue, setVgvValue] = useState<number>(0);
  const [trafficBySource, setTrafficBySource] = useState<Record<LeadSource, number>>({
    meta: 0,
    google: 0,
    whatsapp: 0,
    portais: 0,
    landing: 0,
    outros: 0,
  });
  const [topProperties, setTopProperties] = useState<TopProperty[]>([]);

  const [whatsActivityLines, setWhatsActivityLines] = useState<WhatsActivityLine[]>([]);

  const hasRows = useMemo(() => rows.length > 0, [rows.length]);

  const loadDashboard = useCallback(async () => {
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      setRows([]);
      setPendingCount(0);
      setActiveCount(0);
      setPropertiesCount(0);
      setCarteiraByBrokerId({});
      setTotalImoveisCount(0);
      setAssignedImoveisCount(0);
      setUnassignedImoveisCount(0);
      setLeadsTodayCount(0);
      setLeadsWeekCount(0);
      setLeadsWeekTrend([0, 0, 0, 0, 0, 0, 0]);
      setVgvValue(0);
      setTrafficBySource({
        meta: 0,
        google: 0,
        whatsapp: 0,
        portais: 0,
        landing: 0,
        outros: 0,
      });
      setTopProperties([]);
      return;
    }

    try {
      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);

      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 6);
      startOfWeek.setHours(0, 0, 0, 0);

      const leadsDailyBuckets = new Array<number>(7).fill(0);

      const brokerProfilesQuery = supabase
        .from("profiles")
        .select("id, full_name, whatsapp, creci, status, role, status_aprovacao")
        .eq("role", "broker")
        .eq("status_aprovacao", "aprovado")
        .order("full_name", { ascending: true });

      const brokerProfilesFallbackQuery = supabase
        .from("profiles")
        .select("id, full_name, whatsapp, creci, status, role")
        .eq("role", "broker")
        .order("full_name", { ascending: true });

      const [profilesRes, leadsRes, propertiesRes, vgvRes, obraMaterialsRes, whatsRes, avulsosIdsRes, devIdsRes, inventarioIdsRes] =
        await Promise.allSettled([
          brokerProfilesQuery,
          supabase
            .from("leads")
            .select("id, source, created_at")
            .gte("created_at", startOfWeek.toISOString())
            .order("created_at", { ascending: true }),
          supabase
            .from("standalone_properties")
            .select("id, property_type, purpose, price, address")
            .order("price", { ascending: false })
            .limit(5),
          supabase
            .from("standalone_properties")
            .select("price")
            .not("price", "is", null),
          (supabase as any)
            .from("obra_materials")
            .select("id, status, unit_price, quantity")
            .order("created_at", { ascending: false }),

          // WhatsApp activity today (schema optional)
          supabase
            .from("chat_messages")
            .select(
              "id, thread_id, broker_id, direction, sender_type, sent_at, thread:chat_threads(contact_name, contact_number)",
            )
            .gte("sent_at", startOfToday.toISOString())
            .order("sent_at", { ascending: false })
            .limit(500),

          // unificação: Avulsos + Empreendimentos + Inventário (properties), sempre via corretor_id
          supabase.from("standalone_properties").select("id, corretor_id"),
          (supabase as any).from("developments").select("id, corretor_id"),
          supabase.from("properties").select("id, corretor_id"),
        ]);

      if (profilesRes.status === "fulfilled" && profilesRes.value.error) {
        const fallback = await brokerProfilesFallbackQuery;
        if (fallback.error) {
          setErrorMessage(fallback.error.message);
          setRows([]);
          setPendingCount(0);
          setActiveCount(0);
        } else {
          const allRows = (fallback.data ?? []) as Profile[];
          const pending = allRows.filter((r) => r.status === "pendente").length;
          const active = allRows.filter((r) => r.status === "ativo").length;
          setRows(allRows);
          setPendingCount(pending);
          setActiveCount(active);
        }
      }

      if (profilesRes.status === "fulfilled") {
        if (profilesRes.value.error) {
          // handled above with fallback query
        } else {
          const allRows = (profilesRes.value.data ?? []) as Profile[];
          const pending = allRows.filter((r) => r.status === "pendente").length;
          const active = allRows.filter((r) => r.status === "ativo").length;
          setRows(allRows);
          setPendingCount(pending);
          setActiveCount(active);
        }
      }

      const brokerCountMap = new Map<string, number>();
      let totalCount = 0;
      let assignedCount = 0;
      let unassignedCount = 0;

      const inventorySources: Array<{ res: typeof avulsosIdsRes; label: string }> = [
        { res: avulsosIdsRes, label: "standalone_properties" },
        { res: devIdsRes, label: "developments" },
        { res: inventarioIdsRes, label: "properties" },
      ];

      for (const src of inventorySources) {
        if (src.res.status !== "fulfilled") continue;
        const value: any = src.res.value;
        if (value?.error) {
          console.log("[Dashboard] Erro ao carregar inventário", src.label, value.error);
          continue;
        }

        const data = (value?.data ?? []) as Array<{ id: string; corretor_id?: string | null }>;
        for (const row of data) {
          totalCount += 1;
          const brokerId = (row as any)?.corretor_id ?? null;
          if (brokerId) {
            assignedCount += 1;
            brokerCountMap.set(brokerId, (brokerCountMap.get(brokerId) ?? 0) + 1);
          } else {
            unassignedCount += 1;
          }
        }
      }

      setCarteiraByBrokerId(Object.fromEntries(brokerCountMap.entries()));
      setTotalImoveisCount(totalCount);
      setAssignedImoveisCount(assignedCount);
      setUnassignedImoveisCount(unassignedCount);

      if (leadsRes.status === "fulfilled") {
        if (leadsRes.value.error) {
          setErrorMessage(leadsRes.value.error.message);
          setLeadsTodayCount(0);
          setLeadsWeekCount(0);
          setLeadsWeekTrend([0, 0, 0, 0, 0, 0, 0]);
          setTrafficBySource({
            meta: 0,
            google: 0,
            whatsapp: 0,
            portais: 0,
            landing: 0,
            outros: 0,
          });
        } else {
          const leads = (leadsRes.value.data ?? []) as LeadRow[];
          const bySource: Record<LeadSource, number> = {
            meta: 0,
            google: 0,
            whatsapp: 0,
            portais: 0,
            landing: 0,
            outros: 0,
          };

          let todayCount = 0;
          for (const lead of leads) {
            const createdAt = lead.created_at ? new Date(lead.created_at) : null;
            if (createdAt && createdAt >= startOfToday) todayCount += 1;
            if (createdAt) {
              const daysSince = Math.floor(
                (createdAt.getTime() - startOfWeek.getTime()) / (24 * 60 * 60 * 1000),
              );
              if (daysSince >= 0 && daysSince < 7) leadsDailyBuckets[daysSince] += 1;
            }
            const normalized = normalizeLeadSource(lead.source);
            bySource[normalized] += 1;
          }

          setLeadsTodayCount(todayCount);
          setLeadsWeekCount(leads.length);
          setLeadsWeekTrend(leadsDailyBuckets);
          setTrafficBySource(bySource);
        }
      }

      if (propertiesRes.status === "fulfilled") {
        if (propertiesRes.value.error) {
          setErrorMessage(propertiesRes.value.error.message);
          setTopProperties([]);
          setPropertiesCount(0);
        } else {
          const top = (propertiesRes.value.data ?? []) as TopProperty[];
          setTopProperties(top);
          setPropertiesCount(top.length);
        }
      }

      if (vgvRes.status === "fulfilled") {
        if (vgvRes.value.error) {
          setErrorMessage(vgvRes.value.error.message);
          setVgvValue(0);
        } else {
          const prices = (vgvRes.value.data ?? []) as Array<{ price: number | null }>;
          const sum = prices.reduce((acc, row) => acc + (row.price ?? 0), 0);
          setVgvValue(sum);
        }
      }

      if (obraMaterialsRes.status === "fulfilled") {
        if (obraMaterialsRes.value.error) {
          setObraMaterialsTotal(0);
          setObraPendingDeliveries(0);
        } else {
          const mats = (obraMaterialsRes.value.data ?? []) as ObraMaterialRow[];
          const total = mats.reduce((acc, m) => acc + (m.unit_price ?? 0) * (m.quantity ?? 0), 0);
          const pending = mats.filter((m) => (m.status ?? "") !== "entregue").length;
          setObraMaterialsTotal(total);
          setObraPendingDeliveries(pending);
        }
      }

      if (whatsRes.status === "fulfilled") {
        if (whatsRes.value.error) {
          console.log("[Dashboard] Erro ao carregar chat_messages:", whatsRes.value.error);
          setWhatsActivityLines([]);
        } else {
          const msgRows = (whatsRes.value.data ?? []) as Array<any>;
          const profilesById = new Map<string, Profile>();
          if (profilesRes.status === "fulfilled" && !profilesRes.value.error) {
            const allRows = (profilesRes.value.data ?? []) as Profile[];
            for (const p of allRows) profilesById.set(p.id, p);
          }

          const bucket = new Map<string, { brokerId: string; brokerName: string; leadLabel: string; count: number; threadId: string }>();

          for (const m of msgRows) {
            const senderType = (m.sender_type ?? null) as string | null;
            const brokerId = (m.broker_id ?? null) as string | null;
            const direction = (m.direction ?? null) as string | null;

            const isBrokerMessage = senderType
              ? senderType === "broker"
              : Boolean(brokerId) && direction === "out";
            if (!isBrokerMessage) continue;
            if (!brokerId) continue;

            const thread = m.thread as { contact_name?: string | null; contact_number?: string | null } | null;
            const leadLabel =
              (thread?.contact_name ?? "").trim() || (thread?.contact_number ?? "").trim() || "Lead";

            const brokerName = (profilesById.get(brokerId)?.full_name ?? "").trim() || "Corretor";
            const key = `${brokerId}::${m.thread_id ?? ""}`;
            const current = bucket.get(key);
            if (current) {
              current.count += 1;
            } else {
              bucket.set(key, {
                brokerId,
                brokerName,
                leadLabel,
                count: 1,
                threadId: String(m.thread_id ?? ""),
              });
            }
          }

          const lines = Array.from(bucket.values())
            .filter((l) => l.threadId)
            .sort((a, b) => b.count - a.count)
            .slice(0, 8)
            .map((l) => ({
              brokerName: l.brokerName,
              leadLabel: l.leadLabel,
              count: l.count,
              threadId: l.threadId,
            }));

          setWhatsActivityLines(lines);
        }
      }
    } catch {
      console.log("Silenciando erro de auth");
      setRows([]);
      setPendingCount(0);
      setActiveCount(0);
      setPropertiesCount(0);
      setCarteiraByBrokerId({});
      setTotalImoveisCount(0);
      setAssignedImoveisCount(0);
      setUnassignedImoveisCount(0);
      setLeadsTodayCount(0);
      setLeadsWeekCount(0);
      setLeadsWeekTrend([0, 0, 0, 0, 0, 0, 0]);
      setVgvValue(0);
      setObraMaterialsTotal(0);
      setObraPendingDeliveries(0);
      setTrafficBySource({
        meta: 0,
        google: 0,
        whatsapp: 0,
        portais: 0,
        landing: 0,
        outros: 0,
      });
      setTopProperties([]);
      setWhatsActivityLines([]);
    }
  }, [supabase]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  async function liberarAcesso(profileId: string) {
    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    setUpdatingId(profileId);
    setErrorMessage(null);

    try {
      const { error } = await (supabase as any)
        .from("profiles")
        .update({ status: "ativo" })
        .eq("id", profileId);

      if (error) {
        setErrorMessage(error.message);
        setUpdatingId(null);
        return;
      }
    } catch {
      console.log("Silenciando erro de auth");
      setUpdatingId(null);
      return;
    }

    setRows((current) => current.filter((r) => r.id !== profileId));
    setPendingCount((c) => Math.max(0, c - 1));
    setActiveCount((c) => c + 1);
    setUpdatingId(null);
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">
          PAINEL DE CONTROLE
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Dashboard
        </h1>
        <p className="text-sm leading-relaxed text-slate-600">
          Visão geral operacional de corretores e cadastros.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
          <div className="text-sm font-medium text-slate-600">Total Geral de Imóveis</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {totalImoveisCount}
          </div>
          <div className="mt-2 text-xs text-slate-500">Avulsos + Empreendimentos + Inventário</div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
          <div className="text-sm font-medium text-slate-600">Atribuídos</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {assignedImoveisCount}
          </div>
          <div className="mt-2 text-xs text-slate-500">Com corretor responsável</div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
          <div className="text-sm font-medium text-slate-600">Sem Corretor</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {unassignedImoveisCount}
          </div>
          <div className="mt-2 text-xs text-slate-500">Ações pendentes de distribuição</div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
          <div className="text-sm font-medium text-slate-600">Leads (Hoje)</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {leadsTodayCount}
          </div>
          <div className="mt-3">
            <Sparkline values={leadsWeekTrend} />
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
          <div className="text-sm font-medium text-slate-600">Leads (7 dias)</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {leadsWeekCount}
          </div>
          <div className="mt-2 text-xs text-slate-500">Recebidos nos últimos 7 dias</div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
          <div className="text-sm font-medium text-slate-600">VGV (Inventário)</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {formatCurrencyBRL(vgvValue)}
          </div>
          <div className="mt-2 text-xs text-slate-500">Somatório dos preços de imóveis avulsos</div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-sm font-semibold text-slate-900">Atividade dos Corretores (Hoje)</div>
            <div className="mt-1 text-xs text-slate-500">
              Mensagens enviadas via WhatsApp Business Central
            </div>
          </div>
          <Link
            href="/admin/whatsapp"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-[#001f3f] px-5 text-sm font-semibold text-white shadow-[0_6px_14px_-10px_rgba(15,23,42,0.45)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#001a33]"
          >
            Abrir Painel
          </Link>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          {whatsActivityLines.length > 0 ? (
            whatsActivityLines.map((l) => (
              <Link
                key={`${l.threadId}-${l.brokerName}`}
                href={`/admin/whatsapp?thread=${encodeURIComponent(l.threadId)}`}
                className="rounded-2xl bg-slate-50 px-5 py-4 text-sm text-slate-700 ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-white"
              >
                <span className="font-semibold text-slate-900">Corretor {l.brokerName}</span> enviou{" "}
                <span className="font-semibold text-slate-900">{l.count}</span> mensagens para o Lead{" "}
                <span className="font-semibold text-slate-900">{l.leadLabel}</span> hoje.
              </Link>
            ))
          ) : (
            <div className="rounded-2xl bg-slate-50 px-5 py-6 text-sm text-slate-600 ring-1 ring-slate-200/70">
              Nenhuma atividade de WhatsApp registrada hoje.
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
          <div className="text-sm font-medium text-slate-600">Obra: gastos (materiais)</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {formatCurrencyBRL(obraMaterialsTotal)}
          </div>
          <div className="mt-2 text-xs text-slate-500">Somatório unitário x quantidade</div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
          <div className="text-sm font-medium text-slate-600">Obra: pendências de entrega</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {obraPendingDeliveries}
          </div>
          <div className="mt-2 text-xs text-slate-500">Materiais ainda não entregues</div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70 lg:col-span-2">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="text-sm font-semibold text-slate-900">Origem de Tráfego</div>
              <div className="mt-1 text-xs text-slate-500">
                Meta, Google, WhatsApp, Portais, Landing
              </div>
            </div>
            <div className="text-xs text-slate-500">Últimos 7 dias</div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(
              [
                ["Meta", "meta"],
                ["Google", "google"],
                ["WhatsApp", "whatsapp"],
                ["Portais", "portais"],
                ["Landing", "landing"],
                ["Outros", "outros"],
              ] as const
            ).map(([label, key]) => (
              <div
                key={key}
                className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200/70"
              >
                <div className="text-xs font-semibold tracking-wide text-slate-600">
                  {label}
                </div>
                <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                  {trafficBySource[key] ?? 0}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
          <div className="text-sm font-semibold text-slate-900">Imóveis Top</div>
          <div className="mt-1 text-xs text-slate-500">Top 5 por preço (avulsos)</div>

          <div className="mt-4 flex flex-col gap-3">
            {topProperties.length > 0 ? (
              topProperties.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200/70"
                >
                  <div className="text-sm font-semibold text-slate-900">
                    {p.property_type} • {p.purpose}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{p.address ?? "-"}</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {typeof p.price === "number" ? formatCurrencyBRL(p.price) : "-"}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl bg-slate-50 px-4 py-6 text-sm text-slate-600 ring-1 ring-slate-200/70">
                Nenhum imóvel encontrado.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Corretores cadastrados</h2>
            <p className="text-sm leading-relaxed text-slate-600">
              Listagem completa para validar a conexão. Você pode aprovar quem estiver pendente.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-slate-900 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50"
          >
            Recarregar
          </button>
        </div>

        {errorMessage ? (
          <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200/70">
            {errorMessage}
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-2xl bg-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">
                  Nome
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">
                  Imóveis em Carteira
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">
                  Status
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">
                  WhatsApp
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">
                  CRECI
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold tracking-wide text-slate-700">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {hasRows ? (
                (rows ?? []).map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-5 py-4 text-sm text-slate-900">
                      {row.full_name ?? "-"}
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                      {carteiraByBrokerId[row.id] ?? 0}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      {row.status ?? "-"}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      {row.whatsapp ?? "-"}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      {row.creci ?? "-"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {row.status === "pendente" ? (
                        <button
                          type="button"
                          onClick={() => liberarAcesso(row.id)}
                          disabled={updatingId === row.id}
                          className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {updatingId === row.id ? "Liberando..." : "Liberar Acesso"}
                        </button>
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-5 py-8 text-sm text-slate-600" colSpan={6}>
                    Nenhum registro encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
