"use client";

import { useEffect, useMemo, useState } from "react";

import {
  ArrowLeft,
  ArrowRight,
  Filter,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";

import { getSupabaseClient } from "@/lib/supabaseClient";

type LeadStage =
  | "recebido"
  | "qualificado"
  | "atendimento"
  | "visita"
  | "proposta"
  | "contrato"
  | "vendido";

type LeadRow = {
  id: string;
  full_name: string;
  phone: string;
  interest: string | null;
  stage: LeadStage;
  source: string | null;
  assigned_broker_profile_id?: string | null;
  created_at?: string;
};

type BrokerProfile = {
  id: string;
  full_name: string | null;
  creci: string | null;
  status: string | null;
  specialties?: string[] | null;
  regions?: string[] | null;
  avatar_url?: string | null;
  role?: string | null;
};

type FormState = {
  full_name: string;
  phone: string;
  interest: string;
  source: string;
};

const stages: Array<{ key: LeadStage; label: string; hint: string }> = [
  { key: "recebido", label: "Recebido", hint: "Entrada (ADS, portais, WhatsApp, LP)." },
  { key: "qualificado", label: "Qualificado", hint: "Lead validado (perfil e intenção)." },
  { key: "atendimento", label: "Atendimento", hint: "Contato ativo e diagnóstico." },
  { key: "visita", label: "Visita", hint: "Agendado/realizado." },
  { key: "proposta", label: "Proposta", hint: "Negociação." },
  { key: "contrato", label: "Contrato", hint: "Documentação e assinatura." },
  { key: "vendido", label: "Vendido", hint: "Fechamento concluído." },
];

function stageBadgeCls(stage: LeadStage) {
  if (stage === "recebido") return "bg-slate-50 text-slate-700 ring-slate-200/70";
  if (stage === "qualificado") return "bg-indigo-50 text-indigo-700 ring-indigo-200/70";
  if (stage === "atendimento") return "bg-sky-50 text-sky-700 ring-sky-200/70";
  if (stage === "visita") return "bg-amber-50 text-amber-700 ring-amber-200/70";
  if (stage === "proposta") return "bg-violet-50 text-violet-700 ring-violet-200/70";
  if (stage === "contrato") return "bg-emerald-50 text-emerald-700 ring-emerald-200/70";
  return "bg-slate-100 text-slate-700 ring-slate-200/70";
}

function nextStage(stage: LeadStage): LeadStage {
  const idx = stages.findIndex((s) => s.key === stage);
  return stages[Math.min(stages.length - 1, idx + 1)]!.key;
}

function prevStage(stage: LeadStage): LeadStage {
  const idx = stages.findIndex((s) => s.key === stage);
  return stages[Math.max(0, idx - 1)]!.key;
}

function normalizeText(input: string) {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function tokenize(input: string) {
  const normalized = normalizeText(input);
  if (!normalized) return [];
  return normalized
    .split(/[^a-z0-9]+/g)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => t.length >= 3);
}

function formatInitials(name: string) {
  const parts = name
    .split(" ")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return "-";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase();
}

function sourceBadgeCls(source: string | null) {
  const s = normalizeText(source ?? "");
  if (!s) return "bg-slate-100 text-slate-700 ring-slate-200/70";
  if (s.includes("meta") || s.includes("facebook") || s.includes("instagram")) {
    return "bg-sky-50 text-sky-700 ring-sky-200/70";
  }
  if (s.includes("whats")) return "bg-emerald-50 text-emerald-700 ring-emerald-200/70";
  if (s.includes("google") || s.includes("adwords") || s.includes("gads")) {
    return "bg-amber-50 text-amber-800 ring-amber-200/70";
  }
  if (s.includes("portal")) return "bg-violet-50 text-violet-700 ring-violet-200/70";
  if (s.includes("landing") || s.includes("lp")) return "bg-indigo-50 text-indigo-700 ring-indigo-200/70";
  return "bg-slate-100 text-slate-700 ring-slate-200/70";
}

function sanitizePhone(input: string) {
  return input.replace(/[^0-9+]/g, "").trim();
}

export default function LeadsAdminPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [rows, setRows] = useState<LeadRow[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [brokerFilter, setBrokerFilter] = useState<string>("");

  const [brokers, setBrokers] = useState<BrokerProfile[]>([]);
  const [autoDistribute, setAutoDistribute] = useState(true);
  const [isDistributing, setIsDistributing] = useState(false);

  const [form, setForm] = useState<FormState>({
    full_name: "",
    phone: "",
    interest: "",
    source: "",
  });

  const normalizedSearch = useMemo(() => normalizeText(search), [search]);

  const filtered = useMemo(() => {
    const bySource = sourceFilter.trim().toLowerCase();
    const byBroker = brokerFilter.trim();

    return (rows ?? []).filter((r) => {
      if (bySource && (r.source ?? "").toLowerCase() !== bySource) return false;
      if (byBroker && (r.assigned_broker_profile_id ?? "") !== byBroker) return false;
      if (!normalizedSearch) return true;

      const haystack = normalizeText(
        [r.full_name, r.phone, r.interest ?? "", r.source ?? "", r.stage].join(" "),
      );
      return haystack.includes(normalizedSearch);
    });
  }, [brokerFilter, normalizedSearch, rows, sourceFilter]);

  const uniqueSources = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const s = (r.source ?? "").trim();
      if (s) set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  async function distributeUnassigned() {
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    if (brokers.length === 0) {
      setErrorMessage("Nenhum corretor ativo encontrado para distribuição.");
      return;
    }

    const targets = (rows ?? []).filter((r) => !r.assigned_broker_profile_id);
    if (targets.length === 0) return;

    setIsDistributing(true);

    try {
      for (const lead of targets) {
        const brokerId = pickBrokerForLead(lead.interest ?? lead.full_name, lead.source);
        if (!brokerId) break;
        const { error } = await (supabase as any)
          .from("leads")
          .update({ assigned_broker_profile_id: brokerId })
          .eq("id", lead.id);
        if (error) {
          setErrorMessage(error.message);
          break;
        }
      }

      await load();
    } catch {
      setErrorMessage("Não foi possível distribuir os leads agora.");
    } finally {
      setIsDistributing(false);
    }
  }

  const brokerById = useMemo(() => {
    const map = new Map<string, BrokerProfile>();
    for (const b of brokers) map.set(b.id, b);
    return map;
  }, [brokers]);

  function pickNextBrokerId(pool: BrokerProfile[], poolKey: string): string | null {
    if (pool.length === 0) return null;

    const key = `lead_distribution_rr_index:${poolKey}`;
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(key);
    const idx = raw ? Number(raw) : 0;
    const safeIdx = Number.isFinite(idx) ? idx : 0;
    const next = pool[safeIdx % pool.length]!.id;

    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, String((safeIdx + 1) % pool.length));
    }

    return next;
  }

  function pickBrokerForLead(leadInterest: string, leadSource: string | null) {
    const activePool = brokers;
    if (activePool.length === 0) return null;

    const interestTokens = tokenize(leadInterest);
    const sourceTokens = tokenize(leadSource ?? "");
    const tokens = Array.from(new Set([...interestTokens, ...sourceTokens]));

    const scored = activePool
      .map((b) => {
        const specialties = (b.specialties ?? []).map((s) => normalizeText(s));
        const regions = (b.regions ?? []).map((r) => normalizeText(r));

        let score = 0;
        for (const t of tokens) {
          if (specialties.some((s) => s.includes(t))) score += 2;
          if (regions.some((r) => r.includes(t))) score += 1;
        }

        return { broker: b, score };
      })
      .sort((a, b) => b.score - a.score);

    const topScore = scored[0]?.score ?? 0;
    if (topScore <= 0) {
      return pickNextBrokerId(activePool, "fallback");
    }

    const topPool = scored.filter((s) => s.score === topScore).map((s) => s.broker);
    const poolKey = `score_${topScore}`;
    return pickNextBrokerId(topPool, poolKey);
  }

  async function loadBrokers() {
    if (!supabase) {
      setBrokers([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, creci, status, role, specialties, regions, avatar_url")
        .eq("role", "broker")
        .order("full_name", { ascending: true });

      if (error) {
        setBrokers([]);
        return;
      }

      const all = (data ?? []) as BrokerProfile[];
      const active = all.filter((b) => (b.status ?? "").toLowerCase() === "ativo");
      setBrokers(active);
    } catch {
      setBrokers([]);
    }
  }

  async function load() {
    setErrorMessage(null);

    if (!supabase) {
      setRows([]);
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    try {
      const { data, error } = await supabase
        .from("leads")
        .select(
          "id, full_name, phone, interest, stage, source, assigned_broker_profile_id, created_at",
        )
        .order("created_at", { ascending: false });

      if (error) {
        setRows([]);
        setErrorMessage(error.message);
        return;
      }

      setRows((data ?? []) as LeadRow[]);
    } catch {
      setRows([]);
      setErrorMessage("Não foi possível carregar o funil agora.");
    }
  }

  useEffect(() => {
    void load();
    void loadBrokers();
  }, []);

  async function createLead(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    const assignedBrokerId = autoDistribute
      ? pickBrokerForLead(form.interest || form.full_name, form.source)
      : null;

    const payload = {
      id: crypto.randomUUID(),
      full_name: form.full_name.trim(),
      phone: sanitizePhone(form.phone),
      interest: form.interest.trim() ? form.interest.trim() : null,
      stage: "recebido" as const,
      source: form.source.trim() ? form.source.trim() : null,
      assigned_broker_profile_id: assignedBrokerId,
    };

    if (!payload.full_name || !payload.phone) {
      setErrorMessage("Informe Nome e Telefone.");
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await (supabase as any).from("leads").insert(payload);
      if (error) {
        setErrorMessage(error.message);
        setIsSaving(false);
        return;
      }

      setForm({ full_name: "", phone: "", interest: "", source: "" });
      setIsSaving(false);
      await load();
    } catch {
      setIsSaving(false);
      setErrorMessage("Não foi possível cadastrar o lead agora.");
    }
  }

  async function moveLead(leadId: string, stage: LeadStage) {
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    setMovingLeadId(leadId);

    try {
      const { error } = await (supabase as any)
        .from("leads")
        .update({ stage })
        .eq("id", leadId);

      if (error) {
        setErrorMessage(error.message);
        setMovingLeadId(null);
        return;
      }

      setRows((current) => current.map((l) => (l.id === leadId ? { ...l, stage } : l)));
      setMovingLeadId(null);
    } catch {
      setErrorMessage("Não foi possível mover o lead agora.");
      setMovingLeadId(null);
    }
  }

  const countsByStage = useMemo(() => {
    const base: Record<LeadStage, number> = {
      recebido: 0,
      qualificado: 0,
      atendimento: 0,
      visita: 0,
      proposta: 0,
      contrato: 0,
      vendido: 0,
    };

    for (const r of filtered) {
      base[r.stage] += 1;
    }
    return base;
  }, [filtered]);

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">
          CRM • FUNIL AUTOMÁTICO
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Leads</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          Kanban operacional com 7 etapas e origem rastreada. Render estático primeiro, dados em segundo plano.
        </p>
      </header>

      {errorMessage ? (
        <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200/70">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">Novo lead</div>
                <div className="mt-1 text-xs text-slate-500">Entrada padrão cai em “Recebido”.</div>
              </div>
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar
              </button>
            </div>

            <form onSubmit={createLead} className="mt-5 flex flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold tracking-wide text-slate-600">Nome</span>
                <input
                  value={form.full_name}
                  onChange={(e) => setForm((s) => ({ ...s, full_name: e.target.value }))}
                  className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                  placeholder="Cliente"
                  required
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold tracking-wide text-slate-600">Telefone</span>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                    className="h-11 w-full rounded-xl bg-white pl-10 pr-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                    placeholder="(DDD) 9xxxx-xxxx"
                    required
                  />
                </div>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold tracking-wide text-slate-600">Interesse</span>
                <input
                  value={form.interest}
                  onChange={(e) => setForm((s) => ({ ...s, interest: e.target.value }))}
                  className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                  placeholder="Ex: Apartamento 2 dorm"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold tracking-wide text-slate-600">Origem</span>
                <input
                  value={form.source}
                  onChange={(e) => setForm((s) => ({ ...s, source: e.target.value }))}
                  className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                  placeholder="Meta, Google, WhatsApp, Portais, Landing"
                />
              </label>

              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.20)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                {isSaving ? "Salvando..." : "Cadastrar"}
              </button>
            </form>
          </div>

          <div className="mt-6 rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">Filtros</div>
                <div className="mt-1 text-xs text-slate-500">Pesquisa e origem (não trava o Kanban).</div>
              </div>
              <Filter className="h-4 w-4 text-slate-400" />
            </div>

            <div className="mt-5 flex flex-col gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-11 w-full rounded-xl bg-white pl-10 pr-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                  placeholder="Nome, telefone, interesse, origem..."
                />
              </div>

              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="h-11 w-full rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
              >
                <option value="">Todas as origens</option>
                {uniqueSources.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                value={brokerFilter}
                onChange={(e) => setBrokerFilter(e.target.value)}
                className="h-11 w-full rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
              >
                <option value="">Todos os corretores</option>
                {brokers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.full_name ?? "-"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">Distribuição</div>
                <div className="mt-1 text-xs text-slate-500">
                  Round-robin (corretores ativos). Atribuição sem Auth.
                </div>
              </div>
              <Users className="h-4 w-4 text-slate-400" />
            </div>

            <div className="mt-5 flex flex-col gap-3">
              <label className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200/70">
                <div className="text-sm font-semibold text-slate-900">Auto-distribuir novos leads</div>
                <input
                  type="checkbox"
                  checked={autoDistribute}
                  onChange={(e) => setAutoDistribute(e.target.checked)}
                />
              </label>

              <button
                type="button"
                onClick={() => void distributeUnassigned()}
                disabled={isDistributing}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.20)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDistributing ? "Distribuindo..." : "Distribuir leads sem corretor"}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="kanban-scroll -mx-2 overflow-x-auto px-2 pb-3">
            <div className="flex min-w-max gap-6 pr-3">
              {stages.map((stage) => {
                const stageRows = filtered.filter((r) => r.stage === stage.key);

                return (
                  <div
                    key={stage.key}
                    className="w-[300px] shrink-0 rounded-2xl bg-white p-5 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70 sm:w-[320px] lg:w-[340px]"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900">{stage.label}</div>
                        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-50 px-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70">
                          {countsByStage[stage.key] ?? 0}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">{stage.hint}</div>
                    </div>

                    <div className="mt-4 flex max-h-[68vh] flex-col gap-3 overflow-auto pr-1">
                      {stageRows.length > 0 ? (
                        stageRows.map((lead) => {
                          const canMoveBack = lead.stage !== stages[0]!.key;
                          const canMoveNext = lead.stage !== stages[stages.length - 1]!.key;

                          return (
                            <div
                              key={lead.id}
                              className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50/70"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-slate-900">
                                    {lead.full_name}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-600">{lead.phone}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={
                                      "inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 " +
                                      sourceBadgeCls(lead.source)
                                    }
                                  >
                                    {(lead.source ?? "Outros").slice(0, 18)}
                                  </span>
                                  <span
                                    className={
                                      "inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 " +
                                      stageBadgeCls(lead.stage)
                                    }
                                  >
                                    {stage.label}
                                  </span>
                                </div>
                              </div>

                              {lead.interest ? (
                                <div className="mt-3 text-xs text-slate-700">
                                  <span className="font-semibold text-slate-900">Interesse:</span> {lead.interest}
                                </div>
                              ) : null}

                              <div className="mt-3 flex items-center justify-between gap-2">
                                <div className="flex min-w-0 flex-col gap-0.5">
                                  <div className="truncate text-[11px] text-slate-500">
                                    Corretor: {(() => {
                                      const id = lead.assigned_broker_profile_id ?? "";
                                      if (!id) return "-";
                                      const broker = brokerById.get(id);
                                      return broker?.full_name ?? id;
                                    })()}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={!canMoveBack || movingLeadId === lead.id}
                                    onClick={() => moveLead(lead.id, prevStage(lead.stage))}
                                    className="inline-flex h-9 items-center justify-center rounded-xl bg-white px-3 text-xs font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <ArrowLeft className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!canMoveNext || movingLeadId === lead.id}
                                    onClick={() => moveLead(lead.id, nextStage(lead.stage))}
                                    className="inline-flex h-9 items-center justify-center rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.20)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <ArrowRight className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>

                              {(() => {
                                const id = lead.assigned_broker_profile_id ?? "";
                                const broker = id ? brokerById.get(id) : null;
                                if (!broker) return null;
                                const initials = formatInitials(broker.full_name ?? "");
                                return (
                                  <div className="mt-3 flex items-center justify-between">
                                    <div className="text-[11px] text-slate-500">Responsável</div>
                                    {broker.avatar_url ? (
                                      <img
                                        src={broker.avatar_url}
                                        alt={broker.full_name ?? "Corretor"}
                                        className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-200/70"
                                      />
                                    ) : (
                                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70">
                                        {initials}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-xl bg-slate-50 px-4 py-6 text-xs text-slate-600 ring-1 ring-slate-200/70">
                          Sem leads nesta etapa.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
