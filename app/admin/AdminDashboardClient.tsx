"use client";

import Link from "next/link";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AlertTriangle,
  BadgeDollarSign,
  LineChart,
  Scale,
  User,
  Users,
} from "lucide-react";

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
  stage?: string | null;
};

type DirecionamentoRow = {
  id: string;
  title: string | null;
  neighborhood: string | null;
  city: string | null;
  corretor_id: string | null;
  data_direcionamento: string | null;
  created_at?: string | null;
};

type DirecionamentoUnionRow = {
  id: string;
  title: string | null;
  neighborhood: string | null;
  city: string | null;
  corretor_id: string | null;
  data_direcionamento: string | null;
  created_at?: string | null;
  source: "properties" | "developments";
};

type DirecionamentoViewRow = {
  id: string;
  brokerName: string;
  propertyLabel: string;
  directedAtIso: string;
  daysSince: number;
};

type TopProperty = {
  id: string;
  title: string | null;
  property_type: string;
  purpose: string;
  price: number | null;
  neighborhood: string | null;
  city: string | null;
};

type ObraMaterialRow = {
  id: string;
  status: string | null;
  unit_price: number | null;
  quantity: number | null;
};

type ObraWorkerRow = {
  id: string;
  daily_rate: number | null;
  hourly_rate: number | null;
};

type ObraWorkerEntryRow = {
  id: string;
  worker_id: string;
  entry_type: string | null;
  hours: number | null;
};

type MarketingExpenseRow = {
  id: string;
  amount: number | null;
};

type VehicleExpenseRow = {
  id: string;
  amount: number | null;
};

type LegalCaseRow = {
  id: string;
  due_diligence_json?: any;
};

type AppraisalAggRow = {
  id: string;
  status: string | null;
  fair_market_value?: number | null;
  suggested_price?: number | null;
  created_at?: string | null;
};

type LeadStageBucket = "entrada" | "atendimento" | "visita" | "contrato";

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

function safeObject(value: any) {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return null;
}

function computeLegalRiskLevel(due: any): "verde" | "amarelo" | "vermelho" {
  const obj = safeObject(due) as any;
  const raw = obj ?? {};
  const values = [raw?.cert_civel, raw?.cert_trabalhista, raw?.cert_protesto]
    .map((v) => String(v ?? "").toLowerCase())
    .filter(Boolean);
  if (values.some((v) => v === "positiva")) return "vermelho";
  if (values.some((v) => v === "pendente")) return "amarelo";
  return "verde";
}

function bucketFromLeadStage(stage: string | null | undefined): LeadStageBucket {
  const s = String(stage ?? "").trim().toLowerCase();
  if (!s) return "entrada";
  if (s === "visita") return "visita";
  if (s === "contrato" || s === "vendido") return "contrato";
  if (s === "atendimento" || s === "proposta") return "atendimento";
  return "entrada";
}

function purposeBadge(purpose: string) {
  const p = (purpose ?? "").toLowerCase();
  if (p.includes("loc")) {
    return {
      label: "Locação",
      cls: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/70",
    };
  }
  return {
    label: "Venda",
    cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70",
  };
}

function RingLegend({ label, cls }: { label: string; cls: string }) {
  return <span className={"inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold " + cls}>{label}</span>;
}

function LeadsFunnel({ counts }: { counts: Record<LeadStageBucket, number> }) {
  const items: Array<{ key: LeadStageBucket; label: string; cls: string }> = [
    { key: "entrada", label: "Entrada", cls: "bg-sky-50 text-sky-800 ring-sky-200/70" },
    { key: "atendimento", label: "Atendimento", cls: "bg-amber-50 text-amber-900 ring-amber-200/70" },
    { key: "visita", label: "Visita", cls: "bg-violet-50 text-violet-800 ring-violet-200/70" },
    { key: "contrato", label: "Contrato", cls: "bg-emerald-50 text-emerald-800 ring-emerald-200/70" },
  ];

  const max = Math.max(1, ...items.map((i) => counts[i.key] ?? 0));
  return (
    <div className="mt-4 flex flex-col gap-2">
      {items.map((i) => {
        const value = counts[i.key] ?? 0;
        const width = Math.max(12, Math.round((value / max) * 100));
        return (
          <div key={i.key} className="flex items-center gap-3">
            <div className={"w-28 rounded-full px-3 py-1 text-xs font-semibold ring-1 " + i.cls}>{i.label}</div>
            <div className="flex-1">
              <div className="h-3 w-full rounded-full bg-slate-100 ring-1 ring-slate-200/70">
                <div className="h-3 rounded-full bg-slate-900/70" style={{ width: `${width}%` }} />
              </div>
            </div>
            <div className="w-10 text-right text-xs font-semibold text-slate-900">{value}</div>
          </div>
        );
      })}
    </div>
  );
}

function formatDaysSinceLabel(days: number) {
  if (!Number.isFinite(days) || days < 0) return "-";
  if (days === 0) return "Hoje";
  if (days === 1) return "Há 1 dia";
  return `Há ${days} dias`;
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

  const [propertiesStockCount, setPropertiesStockCount] = useState<number>(0);

  const [carteiraByBrokerId, setCarteiraByBrokerId] = useState<Record<string, number>>({});
  const [totalImoveisCount, setTotalImoveisCount] = useState<number>(0);
  const [assignedImoveisCount, setAssignedImoveisCount] = useState<number>(0);
  const [unassignedImoveisCount, setUnassignedImoveisCount] = useState<number>(0);

  const [obraMaterialsTotal, setObraMaterialsTotal] = useState<number>(0);
  const [obraPendingDeliveries, setObraPendingDeliveries] = useState<number>(0);
  const [obraLaborTotal, setObraLaborTotal] = useState<number>(0);

  const [marketingExpensesTotal, setMarketingExpensesTotal] = useState<number>(0);
  const [vehicleExpensesTotal, setVehicleExpensesTotal] = useState<number>(0);

  const [leadsTodayCount, setLeadsTodayCount] = useState<number>(0);
  const [leadsWeekCount, setLeadsWeekCount] = useState<number>(0);
  const [leadsWeekTrend, setLeadsWeekTrend] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [vgvValue, setVgvValue] = useState<number>(0);

  const [grossInventoryValue, setGrossInventoryValue] = useState<number>(0);
  const [grossPropertiesValue, setGrossPropertiesValue] = useState<number>(0);
  const [grossDevelopmentsValue, setGrossDevelopmentsValue] = useState<number>(0);
  const [commissionValue, setCommissionValue] = useState<number>(0);
  const [netProfitValue, setNetProfitValue] = useState<number>(0);

  const [lastOwnerContactAt, setLastOwnerContactAt] = useState<string | null>(null);
  const [trafficBySource, setTrafficBySource] = useState<Record<LeadSource, number>>({
    meta: 0,
    google: 0,
    whatsapp: 0,
    portais: 0,
    landing: 0,
    outros: 0,
  });
  const [topProperties, setTopProperties] = useState<TopProperty[]>([]);

  const [leadFunnel, setLeadFunnel] = useState<Record<LeadStageBucket, number>>({
    entrada: 0,
    atendimento: 0,
    visita: 0,
    contrato: 0,
  });

  const [legalRiskCounts, setLegalRiskCounts] = useState<{ verde: number; amarelo: number; vermelho: number }>({
    verde: 0,
    amarelo: 0,
    vermelho: 0,
  });

  const [ptamMonthCount, setPtamMonthCount] = useState<number>(0);
  const [ptamMonthAvgValue, setPtamMonthAvgValue] = useState<number>(0);

  const [direcionamentos, setDirecionamentos] = useState<DirecionamentoViewRow[]>([]);

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
      setPropertiesStockCount(0);
      setCarteiraByBrokerId({});
      setTotalImoveisCount(0);
      setAssignedImoveisCount(0);
      setUnassignedImoveisCount(0);
      setLeadsTodayCount(0);
      setLeadsWeekCount(0);
      setLeadsWeekTrend([0, 0, 0, 0, 0, 0, 0]);
      setVgvValue(0);
      setGrossInventoryValue(0);
      setGrossPropertiesValue(0);
      setGrossDevelopmentsValue(0);
      setCommissionValue(0);
      setNetProfitValue(0);
      setLastOwnerContactAt(null);
      setTrafficBySource({
        meta: 0,
        google: 0,
        whatsapp: 0,
        portais: 0,
        landing: 0,
        outros: 0,
      });
      setTopProperties([]);
      setDirecionamentos([]);
      setLeadFunnel({ entrada: 0, atendimento: 0, visita: 0, contrato: 0 });
      setLegalRiskCounts({ verde: 0, amarelo: 0, vermelho: 0 });
      setPtamMonthCount(0);
      setPtamMonthAvgValue(0);
      setObraMaterialsTotal(0);
      setObraPendingDeliveries(0);
      setObraLaborTotal(0);
      setMarketingExpensesTotal(0);
      setVehicleExpensesTotal(0);
      return;
    }

    try {
      const supportsDeletedAt = async (table: string) => {
        try {
          const res = await (supabase as any).from(table).select("deleted_at").limit(1);
          return !res?.error;
        } catch {
          return false;
        }
      };

      const supportsColumn = async (table: string, column: string) => {
        try {
          const res = await (supabase as any).from(table).select(`id, ${column}`).limit(1);
          return !res?.error;
        } catch {
          return false;
        }
      };

      const [propertiesHasDeletedAt, developmentsHasDeletedAt] = await Promise.all([
        supportsDeletedAt("properties"),
        supportsDeletedAt("developments"),
      ]);

      let propertiesBrokerColumn: "corretor_id" | "broker_id" = "corretor_id";
      try {
        const test = await (supabase as any).from("properties").select("id, broker_id").limit(1);
        if (!test.error) propertiesBrokerColumn = "broker_id";
      } catch {
        propertiesBrokerColumn = "corretor_id";
      }

      let developmentsBrokerColumn: "corretor_id" | "broker_id" = "broker_id";
      try {
        const test = await (supabase as any).from("developments").select("id, broker_id").limit(1);
        if (test.error) developmentsBrokerColumn = "corretor_id";
      } catch {
        developmentsBrokerColumn = "corretor_id";
      }

      const developmentsValueColumnCandidates = ["lot_value", "price", "value"];
      let developmentsValueColumn: string | null = null;
      for (const col of developmentsValueColumnCandidates) {
        // eslint-disable-next-line no-await-in-loop
        const ok = await supportsColumn("developments", col);
        if (ok) {
          developmentsValueColumn = col;
          break;
        }
      }

      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);

      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 6);
      startOfWeek.setHours(0, 0, 0, 0);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startOfMonth.setHours(0, 0, 0, 0);

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

      let brokerRows: Profile[] = [];

      const [
        profilesRes,
        leadsRes,
        propertiesRes,
        vgvRes,
        vgvWithBrokerRes,
        vgvDevsRes,
        lastOwnerPropRes,
        lastOwnerDevRes,
        obraMaterialsRes,
        obraWorkersRes,
        obraWorkerEntriesRes,
        marketingExpensesRes,
        vehicleExpensesRes,
        whatsRes,
        devIdsRes,
        inventarioIdsRes,
        direcionamentosRes,
        direcionamentosDevsRes,
        legalCasesRes,
        appraisalsRes,
      ] =
        await Promise.allSettled([
          brokerProfilesQuery,
          supabase
            .from("leads")
            .select("id, source, created_at, stage")
            .gte("created_at", startOfWeek.toISOString())
            .order("created_at", { ascending: true }),
          (() => {
            const q = supabase
              .from("properties")
              .select("id, title, property_type, purpose, price, neighborhood, city")
              .order("price", { ascending: false })
              .limit(5);
            return propertiesHasDeletedAt ? q.is("deleted_at", null) : q;
          })(),
          (() => {
            const q = supabase.from("properties").select("price").not("price", "is", null);
            return propertiesHasDeletedAt ? q.is("deleted_at", null) : q;
          })(),

          (() => {
            const q = supabase
              .from("properties")
              .select(`price, ${propertiesBrokerColumn}`)
              .not("price", "is", null);
            return propertiesHasDeletedAt ? q.is("deleted_at", null) : q;
          })(),

          (() => {
            if (!developmentsValueColumn) {
              return Promise.resolve({ data: [], error: null } as any);
            }
            const q = (supabase as any)
              .from("developments")
              .select(`${developmentsValueColumn}, ${developmentsBrokerColumn}`)
              .not(developmentsValueColumn, "is", null);
            return developmentsHasDeletedAt ? q.is("deleted_at", null) : q;
          })(),

          (() => {
            const q = supabase
              .from("properties")
              .select("last_owner_contact_at")
              .not("last_owner_contact_at", "is", null)
              .order("last_owner_contact_at", { ascending: false })
              .limit(1);
            return propertiesHasDeletedAt ? q.is("deleted_at", null) : q;
          })(),

          (() => {
            const q = (supabase as any)
              .from("developments")
              .select("last_owner_contact_at")
              .not("last_owner_contact_at", "is", null)
              .order("last_owner_contact_at", { ascending: false })
              .limit(1);
            return developmentsHasDeletedAt ? q.is("deleted_at", null) : q;
          })(),
          (supabase as any)
            .from("obra_materials")
            .select("id, status, unit_price, quantity")
            .order("created_at", { ascending: false }),

          (supabase as any)
            .from("obra_workers")
            .select("id, daily_rate, hourly_rate")
            .limit(500),

          (supabase as any)
            .from("obra_worker_entries")
            .select("id, worker_id, entry_type, hours")
            .limit(2000),

          (supabase as any).from("marketing_expenses").select("id, amount").limit(5000),

          (supabase as any).from("vehicle_expenses").select("id, amount").limit(5000),

          // WhatsApp activity today (schema optional)
          supabase
            .from("chat_messages")
            .select(
              "id, thread_id, broker_id, direction, sender_type, sent_at, thread:chat_threads(contact_name, contact_number)",
            )
            .gte("sent_at", startOfToday.toISOString())
            .order("sent_at", { ascending: false })
            .limit(500),

          // unificação: Empreendimentos + Inventário (properties), via broker_id/corretor_id autodetect
          (() => {
            const q = (supabase as any).from("developments").select(`id, ${developmentsBrokerColumn}`);
            return developmentsHasDeletedAt ? q.is("deleted_at", null) : q;
          })(),
          (() => {
            const q = supabase.from("properties").select(`id, ${propertiesBrokerColumn}`);
            return propertiesHasDeletedAt ? q.is("deleted_at", null) : q;
          })(),

          // Relatório de direcionamento (posse)
          (() => {
            const q = supabase
              .from("properties")
              .select(`id, title, neighborhood, city, ${propertiesBrokerColumn}, data_direcionamento, created_at`)
              .not(propertiesBrokerColumn, "is", null)
              .order("data_direcionamento", { ascending: false, nullsFirst: false })
              .limit(50);
            return propertiesHasDeletedAt ? q.is("deleted_at", null) : q;
          })(),

          // Relatório de direcionamento (posse) - developments
          (() => {
            const base = (supabase as any)
              .from("developments")
              .select("*")
              .not(developmentsBrokerColumn, "is", null)
              .limit(50);

            return (async () => {
              const q = developmentsHasDeletedAt ? base.is("deleted_at", null) : base;

              let res = await q.order("created_at", { ascending: false });
              if (res?.error) {
                res = await q.order("id", { ascending: false });
              }
              return res;
            })();
          })(),

          // Jurídico (status do escritório)
          (() => {
            const q = (supabase as any).from("legal_cases").select("id, due_diligence_json").limit(500);
            return q;
          })(),

          // Avaliações (PTAM do mês)
          (() => {
            const q = (supabase as any)
              .from("appraisals")
              .select("id, status, fair_market_value, suggested_price, created_at")
              .gte("created_at", startOfMonth.toISOString())
              .order("created_at", { ascending: false })
              .limit(500);
            return q;
          })(),
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
          brokerRows = allRows;
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
          brokerRows = allRows;
          const pending = allRows.filter((r) => r.status === "pendente").length;
          const active = allRows.filter((r) => r.status === "ativo").length;
          setRows(allRows);
          setPendingCount(pending);
          setActiveCount(active);
        }
      }

      const profilesById = new Map<string, Profile>();
      for (const p of brokerRows) profilesById.set(p.id, p);

      const brokerCountMap = new Map<string, number>();
      let totalCount = 0;
      let assignedCount = 0;
      let unassignedCount = 0;

      const inventorySources: Array<{ res: typeof devIdsRes; label: string }> = [
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

        const data = (value?.data ?? []) as Array<any>;
        for (const row of data) {
          totalCount += 1;
          const brokerId = (row as any)?.[src.label === "developments" ? developmentsBrokerColumn : propertiesBrokerColumn] ?? null;
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

      const unionRows: DirecionamentoUnionRow[] = [];

      if (direcionamentosRes.status === "fulfilled") {
        if (direcionamentosRes.value.error) {
          console.log("[Dashboard] Erro ao carregar direcionamentos properties:", direcionamentosRes.value.error);
        } else {
          const data = (direcionamentosRes.value.data ?? []) as Array<any>;
          for (const r of data) {
            const corretor_id = (r as any)?.[propertiesBrokerColumn] ?? null;
            unionRows.push({
              id: String(r?.id ?? crypto.randomUUID()),
              title: (r?.title ?? null) as string | null,
              neighborhood: (r?.neighborhood ?? null) as string | null,
              city: (r?.city ?? null) as string | null,
              corretor_id: corretor_id ? String(corretor_id) : null,
              data_direcionamento: (r?.data_direcionamento ?? null) as string | null,
              created_at: (r?.created_at ?? null) as string | null,
              source: "properties",
            });
          }
        }
      }

      if (direcionamentosDevsRes.status === "fulfilled") {
        if (direcionamentosDevsRes.value.error) {
          console.log("[Dashboard] Erro ao carregar direcionamentos developments:", direcionamentosDevsRes.value.error);
        } else {
          const data = (direcionamentosDevsRes.value.data ?? []) as Array<any>;
          for (const r of data) {
            const corretor_id = (r as any)?.[developmentsBrokerColumn] ?? null;
            unionRows.push({
              id: String(r?.id ?? crypto.randomUUID()),
              title: (String(r?.name ?? r?.title ?? "").trim() || null) as string | null,
              neighborhood: (r?.localidade ?? r?.bairro ?? r?.neighborhood ?? null) as string | null,
              city: (r?.city ?? r?.cidade ?? null) as string | null,
              corretor_id: corretor_id ? String(corretor_id) : null,
              data_direcionamento: null,
              created_at: (r?.created_at ?? null) as string | null,
              source: "developments",
            });
          }
        }
      }

      if (unionRows.length > 0) {
        const brokerIds = Array.from(
          new Set(unionRows.map((r) => (r.corretor_id ?? "").trim()).filter(Boolean)),
        );

        const profilesById = new Map<string, { id: string; full_name: string | null }>();
        if (brokerIds.length > 0) {
          const profRes = await supabase.from("profiles").select("id, full_name").in("id", brokerIds);
          if (!profRes.error) {
            const profRows = (profRes.data ?? []) as Array<{ id: string; full_name: string | null }>;
            for (const p of profRows) profilesById.set(p.id, p);
          }
        }

        const nowTs = Date.now();
        const view = unionRows
          .filter((r) => Boolean(r.corretor_id))
          .sort((a, b) => {
            const aKey = a.data_direcionamento ?? a.created_at ?? "";
            const bKey = b.data_direcionamento ?? b.created_at ?? "";
            return bKey.localeCompare(aKey);
          })
          .slice(0, 50)
          .map((r) => {
            const brokerId = r.corretor_id ?? "";
            const brokerName = (profilesById.get(brokerId)?.full_name ?? "").trim() || brokerId;
            const loc = [r.neighborhood, r.city].filter(Boolean).join(" • ");
            const propertyLabel = (r.title ?? "").trim() || loc || r.id;
            const directedAt = r.data_direcionamento ?? r.created_at ?? "";
            const directedTs = directedAt ? new Date(directedAt).getTime() : NaN;
            const daysSince = Number.isFinite(directedTs)
              ? Math.max(0, Math.floor((nowTs - directedTs) / (24 * 60 * 60 * 1000)))
              : -1;
            return {
              id: r.id,
              brokerName,
              propertyLabel,
              directedAtIso: directedAt,
              daysSince,
            };
          });

        setDirecionamentos(view);
      } else {
        setDirecionamentos([]);
      }

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
          setLeadFunnel({ entrada: 0, atendimento: 0, visita: 0, contrato: 0 });
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

          const funnel: Record<LeadStageBucket, number> = {
            entrada: 0,
            atendimento: 0,
            visita: 0,
            contrato: 0,
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

            const bucket = bucketFromLeadStage(lead.stage ?? null);
            funnel[bucket] += 1;
          }

          setLeadsTodayCount(todayCount);
          setLeadsWeekCount(leads.length);
          setLeadsWeekTrend(leadsDailyBuckets);
          setTrafficBySource(bySource);
          setLeadFunnel(funnel);
        }
      }

      if (propertiesRes.status === "fulfilled") {
        if (propertiesRes.value.error) {
          setErrorMessage(propertiesRes.value.error.message);
          setTopProperties([]);
          setPropertiesCount(0);
          setPropertiesStockCount(0);
        } else {
          const top = (propertiesRes.value.data ?? []) as TopProperty[];
          setTopProperties(top);
          setPropertiesCount(top.length);
        }
      }

      const propsStockRes = await (propertiesHasDeletedAt
        ? supabase.from("properties").select("id", { count: "exact", head: true }).is("deleted_at", null)
        : supabase.from("properties").select("id", { count: "exact", head: true }));
      if (propsStockRes.error) {
        console.log("[Dashboard] Erro ao contar properties", propsStockRes.error);
        setPropertiesStockCount(0);
      } else {
        setPropertiesStockCount(propsStockRes.count ?? 0);
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

      let propsGross = 0;
      let propsAssignedGross = 0;
      if (vgvWithBrokerRes.status === "fulfilled") {
        const value: any = vgvWithBrokerRes.value;
        if (value?.error) {
          console.log("[Dashboard] Erro ao carregar VGV properties (com broker)", value.error);
        } else {
          const rows = (value?.data ?? []) as Array<any>;
          for (const r of rows) {
            const price = typeof r?.price === "number" ? r.price : r?.price != null ? Number(r.price) : 0;
            if (!Number.isFinite(price)) continue;
            propsGross += price;
            const brokerId = r?.[propertiesBrokerColumn] ?? null;
            if (brokerId) propsAssignedGross += price;
          }
        }
      }

      let devGross = 0;
      let devAssignedGross = 0;
      if (vgvDevsRes.status === "fulfilled") {
        const value: any = vgvDevsRes.value;
        if (value?.error) {
          console.log("[Dashboard] Erro ao carregar VGV developments", value.error);
        } else {
          const rows = (value?.data ?? []) as Array<any>;
          for (const r of rows) {
            const raw = developmentsValueColumn ? r?.[developmentsValueColumn] : null;
            const v = typeof raw === "number" ? raw : raw != null ? Number(raw) : 0;
            if (!Number.isFinite(v)) continue;
            devGross += v;
            const brokerId = r?.[developmentsBrokerColumn] ?? null;
            if (brokerId) devAssignedGross += v;
          }
        }
      }

      const gross = propsGross + devGross;
      const commission = 0.05 * (propsAssignedGross + devAssignedGross);

      let materialsExpense = 0;
      let pendingDeliveries = 0;
      if (obraMaterialsRes.status === "fulfilled") {
        if (obraMaterialsRes.value.error) {
          materialsExpense = 0;
          pendingDeliveries = 0;
        } else {
          const mats = (obraMaterialsRes.value.data ?? []) as ObraMaterialRow[];
          materialsExpense = mats.reduce((acc, m) => acc + (m.unit_price ?? 0) * (m.quantity ?? 0), 0);
          pendingDeliveries = mats.filter((m) => (m.status ?? "") !== "entregue").length;
        }
      }

      let laborExpense = 0;
      try {
        const workers =
          obraWorkersRes.status === "fulfilled" && !obraWorkersRes.value.error
            ? ((obraWorkersRes.value.data ?? []) as ObraWorkerRow[])
            : ([] as ObraWorkerRow[]);
        const entries =
          obraWorkerEntriesRes.status === "fulfilled" && !obraWorkerEntriesRes.value.error
            ? ((obraWorkerEntriesRes.value.data ?? []) as ObraWorkerEntryRow[])
            : ([] as ObraWorkerEntryRow[]);

        const workerById = new Map<string, ObraWorkerRow>();
        for (const w of workers) workerById.set(w.id, w);

        laborExpense = entries.reduce((acc, e) => {
          const w = workerById.get(String(e.worker_id ?? ""));
          if (!w) return acc;
          const type = String(e.entry_type ?? "").toLowerCase();
          if (type === "diaria") return acc + (w.daily_rate ?? 0);
          if (type === "hora_homem") return acc + (w.hourly_rate ?? 0) * (e.hours ?? 0);
          return acc;
        }, 0);
      } catch {
        laborExpense = 0;
      }

      let marketingExpense = 0;
      try {
        if (marketingExpensesRes.status === "fulfilled" && !marketingExpensesRes.value.error) {
          const rows = (marketingExpensesRes.value.data ?? []) as MarketingExpenseRow[];
          marketingExpense = rows.reduce((acc, r) => acc + (r.amount ?? 0), 0);
        }
      } catch {
        marketingExpense = 0;
      }

      let vehicleExpense = 0;
      try {
        if (vehicleExpensesRes.status === "fulfilled" && !vehicleExpensesRes.value.error) {
          const rows = (vehicleExpensesRes.value.data ?? []) as VehicleExpenseRow[];
          vehicleExpense = rows.reduce((acc, r) => acc + (r.amount ?? 0), 0);
        }
      } catch {
        vehicleExpense = 0;
      }

      const net = gross - commission - materialsExpense - laborExpense - marketingExpense - vehicleExpense;

      setGrossPropertiesValue(propsGross);
      setGrossDevelopmentsValue(devGross);
      setGrossInventoryValue(gross);
      setCommissionValue(commission);
      setNetProfitValue(net);

      setObraMaterialsTotal(materialsExpense);
      setObraPendingDeliveries(pendingDeliveries);
      setObraLaborTotal(laborExpense);
      setMarketingExpensesTotal(marketingExpense);
      setVehicleExpensesTotal(vehicleExpense);

      try {
        const propRow: any =
          lastOwnerPropRes.status === "fulfilled" && !lastOwnerPropRes.value.error
            ? (lastOwnerPropRes.value.data ?? [])[0]
            : null;
        const devRow: any =
          lastOwnerDevRes.status === "fulfilled" && !lastOwnerDevRes.value.error
            ? (lastOwnerDevRes.value.data ?? [])[0]
            : null;
        const p = String(propRow?.last_owner_contact_at ?? "").trim();
        const d = String(devRow?.last_owner_contact_at ?? "").trim();
        const latest = [p, d].filter(Boolean).sort((a, b) => b.localeCompare(a))[0] ?? null;
        setLastOwnerContactAt(latest);
      } catch {
        setLastOwnerContactAt(null);
      }

      // obra_materials/obra_workers/obra_worker_entries are handled above for net profit breakdown

      if (whatsRes.status === "fulfilled") {
        if (whatsRes.value.error) {
          console.log("[Dashboard] Erro ao carregar chat_messages:", whatsRes.value.error);
          setWhatsActivityLines([]);
        } else {
          const msgRows = (whatsRes.value.data ?? []) as Array<any>;
          // profilesById já montado acima

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
      setObraLaborTotal(0);
      setMarketingExpensesTotal(0);
      setVehicleExpensesTotal(0);
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
      setDirecionamentos([]);
      setLeadFunnel({ entrada: 0, atendimento: 0, visita: 0, contrato: 0 });
      setLegalRiskCounts({ verde: 0, amarelo: 0, vermelho: 0 });
      setPtamMonthCount(0);
      setPtamMonthAvgValue(0);
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

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 border-l-4 border-l-sky-500">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-slate-600">Inventário (Total)</div>
              <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{totalImoveisCount}</div>
              <div className="mt-2 text-xs text-slate-500">Inventário + Empreendimentos</div>
            </div>
            <LineChart className="h-6 w-6 text-sky-700" />
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 border-l-4 border-l-sky-500">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-slate-600">Atribuídos</div>
              <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{assignedImoveisCount}</div>
              <div className="mt-2 text-xs text-slate-500">Com corretor responsável</div>
            </div>
            <Users className="h-6 w-6 text-sky-700" />
          </div>
        </div>

        <div
          className={
            "rounded-2xl p-6 shadow-sm ring-1 border-l-4 " +
            (unassignedImoveisCount > 0
              ? "bg-amber-50/70 ring-amber-200/70 border-l-amber-500"
              : "bg-white ring-slate-200/70 border-l-sky-500")
          }
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-slate-700">Sem Corretor (Alertas)</div>
              <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{unassignedImoveisCount}</div>
              <div className="mt-2 text-xs text-slate-600">Ações pendentes de distribuição</div>
            </div>
            <AlertTriangle className={"h-6 w-6 " + (unassignedImoveisCount > 0 ? "text-amber-700" : "text-sky-700")} />
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-emerald-50 p-6 shadow-sm ring-1 ring-emerald-200/70 border-l-4 border-l-emerald-500">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-emerald-800">Lucro Líquido (Estoque)</div>
              <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
                {netProfitValue > 0 ? formatCurrencyBRL(netProfitValue) : formatCurrencyBRL(0)}
              </div>
              <div className="mt-2 text-xs text-emerald-700">
                Total {formatCurrencyBRL(grossInventoryValue)} • Comissão (5%) {formatCurrencyBRL(commissionValue)}
              </div>
              <div className="mt-2 text-[11px] font-semibold text-emerald-800/80">
                Gastos: Materiais {formatCurrencyBRL(obraMaterialsTotal)} • Medição {formatCurrencyBRL(obraLaborTotal)} • Marketing {formatCurrencyBRL(marketingExpensesTotal)} • Veículo {formatCurrencyBRL(vehicleExpensesTotal)}
              </div>
              <div className="mt-2 text-[11px] font-semibold text-emerald-800/80">
                Inventário: {formatCurrencyBRL(grossPropertiesValue)} • Empreendimentos: {formatCurrencyBRL(grossDevelopmentsValue)}
              </div>
            </div>
            <BadgeDollarSign className="h-6 w-6 text-emerald-700" />
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-sm font-semibold text-slate-900">Auditoria WhatsApp (Proprietário)</div>
            <div className="mt-1 text-xs text-slate-500">Baseado em owner_whatsapp (imóveis + empreendimentos)</div>
          </div>
          <User className="h-6 w-6 text-slate-700" />
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">Indicador</th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">Data</th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">Observação</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-100">
                <td className="px-4 py-3 text-sm font-semibold text-slate-900">Último contato (Proprietário)</td>
                <td className="px-4 py-3 text-sm text-slate-700">
                  {lastOwnerContactAt ? new Date(lastOwnerContactAt).toLocaleString("pt-BR") : "-"}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  Atualiza automaticamente via webhook/envio
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-sm font-semibold text-slate-900">Relatório de Direcionamento</div>
            <div className="mt-1 text-xs text-slate-500">Quem está com a posse do imóvel</div>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">
                  Corretor
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">
                  Imóvel
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">
                  Direcionado em
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">
                  Status de tempo
                </th>
              </tr>
            </thead>
            <tbody>
              {direcionamentos.length > 0 ? (
                direcionamentos.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-slate-100 transition-all duration-300 hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">{r.brokerName}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{r.propertyLabel}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {r.directedAtIso
                        ? new Date(r.directedAtIso).toLocaleDateString("pt-BR")
                        : "Aguardando registro"}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                      {r.directedAtIso ? formatDaysSinceLabel(r.daysSince) : "-"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-sm text-slate-600" colSpan={4}>
                    Nenhum direcionamento registrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 border-l-4 border-l-sky-500">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-slate-600">Leads (7 dias)</div>
              <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{leadsWeekCount}</div>
              <div className="mt-2 text-xs text-slate-500">Recebidos nos últimos 7 dias</div>
            </div>
            <Users className="h-6 w-6 text-sky-700" />
          </div>
          <div className="mt-4">
            <Sparkline values={leadsWeekTrend} />
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 border-l-4 border-l-sky-500 lg:col-span-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-slate-600">Funil de Leads</div>
              <div className="mt-1 text-xs text-slate-500">Entrada → Atendimento → Visita → Contrato</div>
            </div>
            <Users className="h-6 w-6 text-sky-700" />
          </div>
          <LeadsFunnel counts={leadFunnel} />
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-emerald-50 p-6 shadow-sm ring-1 ring-emerald-200/70 border-l-4 border-l-emerald-500">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-emerald-800">VGV (Inventário)</div>
              <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{formatCurrencyBRL(vgvValue)}</div>
              <div className="mt-2 text-xs text-emerald-700">Somatório dos preços do inventário</div>
            </div>
            <BadgeDollarSign className="h-6 w-6 text-emerald-700" />
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">SAÚDE DO NEGÓCIO</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">Centro de comando</div>
            <div className="mt-1 text-xs text-slate-500">Indicadores para ação imediata em 5 segundos</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 border-l-4 border-l-violet-500">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">Status Jurídico</div>
                <div className="mt-1 text-xs text-slate-500">Semáforo dos processos</div>
              </div>
              <Scale className="h-6 w-6 text-violet-700" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-200/70">
                <div className="text-xs font-semibold text-emerald-800">Verdes</div>
                <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{legalRiskCounts.verde}</div>
              </div>
              <div className="rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200/70">
                <div className="text-xs font-semibold text-amber-900">Amarelos</div>
                <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{legalRiskCounts.amarelo}</div>
              </div>
              <div className="rounded-xl bg-red-50 px-4 py-3 ring-1 ring-red-200/70">
                <div className="text-xs font-semibold text-red-800">Vermelhos</div>
                <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{legalRiskCounts.vermelho}</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-500">Fonte: /admin/juridico (due diligence)</div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 border-l-4 border-l-sky-500">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">Avaliações Técnicas</div>
                <div className="mt-1 text-xs text-slate-500">PTAMs emitidos no mês</div>
              </div>
              <LineChart className="h-6 w-6 text-sky-700" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200/70">
                <div className="text-xs font-semibold text-slate-600">Emitidos</div>
                <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{ptamMonthCount}</div>
              </div>
              <div className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200/70">
                <div className="text-xs font-semibold text-slate-600">Média avaliada</div>
                <div className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
                  {ptamMonthAvgValue > 0 ? formatCurrencyBRL(ptamMonthAvgValue) : "-"}
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-500">Fonte: /admin/avaliacoes (status entregue)</div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 border-l-4 border-l-slate-500">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">Legendas</div>
                <div className="mt-1 text-xs text-slate-500">Status e categorias</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <RingLegend label="Operacional" cls="bg-sky-50 text-sky-800 ring-1 ring-sky-200/70" />
              <RingLegend label="Financeiro" cls="bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/70" />
              <RingLegend label="Jurídico" cls="bg-violet-50 text-violet-800 ring-1 ring-violet-200/70" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <RingLegend label="Venda" cls="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70" />
              <RingLegend label="Locação" cls="bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/70" />
            </div>
            <div className="mt-3 text-xs text-slate-500">Use para leitura rápida do inventário</div>
          </div>
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
          <div className="text-sm font-medium text-slate-600">Obra: gastos (medição)</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {formatCurrencyBRL(obraLaborTotal)}
          </div>
          <div className="mt-2 text-xs text-slate-500">Diárias + hora-homem (workers x entries)</div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70 sm:col-span-2">
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
          <div className="mt-1 text-xs text-slate-500">Top 5 por preço (inventário)</div>

          <div className="mt-4 flex flex-col gap-3">
            {topProperties.length > 0 ? (
              topProperties.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200/70"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {(p.title ?? "").trim() || `${p.property_type} • ${p.purpose}`}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {(p.neighborhood ?? "-") + (p.city ? ` • ${p.city}` : "")}
                      </div>
                    </div>
                    <span className={"inline-flex h-8 items-center justify-center rounded-full px-3 text-xs font-semibold " + purposeBadge(p.purpose).cls}>
                      {purposeBadge(p.purpose).label}
                    </span>
                  </div>
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
