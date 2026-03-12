"use client";

import { useEffect, useMemo, useState } from "react";

import {
  ArrowLeft,
  ArrowRight,
  DollarSign,
  Globe,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Search,
  X,
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
  intent?: string | null;
  address?: string | null;
  value_max?: number | string | null;
  estimated_value?: number | null;
  email?: string | null;
  message?: string | null;
  slug_imovel?: string | null;
  stage: LeadStage;
  source: string | null;
  assigned_broker_profile_id?: string | null;
  created_at?: string;
};

type CustomerPreferencesRow = {
  lead_id: string;
  tipo_imovel: string | null;
  valor_max: number | null;
  quartos: number | null;
  bairro: string | null;
  created_at?: string;
  updated_at?: string;
};

type LeadBrain = {
  lead_id: string;
  intent: string | null;
  address: string | null;
  value_max: number | null;
};

type PropertySuggestionRow = {
  id: string;
  title: string | null;
  property_type: string | null;
  purpose: string | null;
  price: number | null;
  neighborhood: string | null;
  city: string | null;
  bedrooms: number | null;
  status: string | null;
};

type LeadEventRow = {
  id: string;
  lead_id: string;
  event_type: string | null;
  notes: string | null;
  created_at?: string;
};

type BrokerProfile = {
  id: string;
  full_name: string | null;
  creci: string | null;
  status: string | null;
  role?: string | null;
  specialties?: string[] | null;
  regions?: string[] | null;
  avatar_url?: string | null;
};

type FormState = {
  full_name: string;
  phone: string;
  interest: string;
  source: string;
};

const LEAD_STAGE_ORDER: LeadStage[] = [
  "recebido",
  "qualificado",
  "atendimento",
  "visita",
  "proposta",
  "contrato",
  "vendido",
];

function nextStage(stage: LeadStage): LeadStage {
  const idx = LEAD_STAGE_ORDER.indexOf(stage);
  if (idx < 0) return stage;
  return LEAD_STAGE_ORDER[Math.min(LEAD_STAGE_ORDER.length - 1, idx + 1)]!;
}

function prevStage(stage: LeadStage): LeadStage {
  const idx = LEAD_STAGE_ORDER.indexOf(stage);
  if (idx < 0) return stage;
  return LEAD_STAGE_ORDER[Math.max(0, idx - 1)]!;
}

function formatCurrencyBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function parseMoneyToNumberBR(input: any) {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  const raw = String(input ?? "").trim();
  if (!raw) return null;

  const cleaned = raw
    .replace(/\s+/g, "")
    .replace(/R\$?/gi, "")
    .replace(/[^0-9.,-]/g, "");

  if (!cleaned) return null;

  const hasDot = cleaned.includes(".");
  const hasComma = cleaned.includes(",");

  let normalized = cleaned;
  if (hasDot && hasComma) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    normalized = normalized.replace(",", ".");
  }

  const num = Number(normalized);
  if (!Number.isFinite(num)) return null;
  return num;
}

function inferBairroFromAddress(address: string) {
  const raw = String(address ?? "").trim();
  if (!raw) return "";
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return "";
  const candidate = parts[parts.length - 2] ?? "";
  if (!candidate) return "";
  if (candidate.length < 3) return "";
  return candidate;
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

function sourceIconName(source: string | null) {
  const s = normalizeText(source ?? "");
  if (!s) return "globe";
  if (s.includes("google") || s.includes("adwords") || s.includes("gads")) return "search";
  if (s.includes("whats")) return "whatsapp";
  return "globe";
}

function sanitizePhone(input: string) {
  return input.replace(/[^0-9+]/g, "").trim();
}

function sourceLabel(source: string | null) {
  const s = String(source ?? "").trim();
  if (!s) return "";
  if (s.toLowerCase() === "elementor") return "";
  if (s.toLowerCase().includes("teste")) return "";
  return s;
}

export default function LeadsAdminPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [rows, setRows] = useState<LeadRow[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [brokerFilter, setBrokerFilter] = useState<string>("");

  const [brokers, setBrokers] = useState<BrokerProfile[]>([]);
  const [autoDistribute, setAutoDistribute] = useState(true);
  const [isDistributing, setIsDistributing] = useState(false);

  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);
  const [leadHistory, setLeadHistory] = useState<LeadEventRow[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const [preferences, setPreferences] = useState<CustomerPreferencesRow | null>(null);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [isPreferencesLoading, setIsPreferencesLoading] = useState(false);
  const [isPreferencesSaving, setIsPreferencesSaving] = useState(false);

  const [leadBrain, setLeadBrain] = useState<LeadBrain | null>(null);

  const [suggestions, setSuggestions] = useState<PropertySuggestionRow[]>([]);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);

  const [dispatchBrokerId, setDispatchBrokerId] = useState<string>("");
  const [isDispatching, setIsDispatching] = useState(false);

  const [form, setForm] = useState<FormState>({
    full_name: "",
    phone: "",
    interest: "",
    source: "",
  });

  useEffect(() => {
    if (!selectedLead) return;
    if (!leadBrain) return;
    if (leadBrain.lead_id !== selectedLead.id) return;

    const tipoFromIntent =
      leadBrain.intent === "comprar" ? "Compra" : leadBrain.intent === "alugar" ? "Aluguel" : null;
    const bairroFromAddress = leadBrain.address ? inferBairroFromAddress(leadBrain.address) : "";
    const valorFromLead = leadBrain.value_max;

    setPreferences((current) => {
      if (!current) {
        return {
          lead_id: selectedLead.id,
          tipo_imovel: tipoFromIntent,
          bairro: bairroFromAddress || null,
          valor_max: typeof valorFromLead === "number" && Number.isFinite(valorFromLead) ? valorFromLead : null,
          quartos: null,
        };
      }

      if (current.lead_id !== selectedLead.id) return current;

      const next: CustomerPreferencesRow = { ...current };

      if (!String(next.tipo_imovel ?? "").trim() && tipoFromIntent) next.tipo_imovel = tipoFromIntent;
      if (!String(next.bairro ?? "").trim() && bairroFromAddress) next.bairro = bairroFromAddress;
      if (next.valor_max == null && typeof valorFromLead === "number" && Number.isFinite(valorFromLead)) {
        next.valor_max = valorFromLead;
      }

      return next;
    });
  }, [leadBrain, selectedLead]);

  const normalizedSearch = useMemo(() => normalizeText(search), [search]);

  const columns = useMemo(
    () =>
      [
        {
          key: "novo" as const,
          label: "Novo",
          headerCls: "bg-sky-600",
          stages: ["recebido", "qualificado"] as LeadStage[],
        },
        {
          key: "atendimento" as const,
          label: "Atendimento",
          headerCls: "bg-amber-500",
          stages: ["atendimento", "visita", "proposta", "contrato"] as LeadStage[],
        },
        {
          key: "ganho" as const,
          label: "Ganho",
          headerCls: "bg-emerald-600",
          stages: ["vendido"] as LeadStage[],
        },
      ] as const,
    [],
  );

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
      const eligible = all.filter((b) => {
        const s = (b.status ?? "").toLowerCase();
        return s === "ativo" || s === "aprovado";
      });
      setBrokers(eligible);
    } catch {
      setBrokers([]);
    }
  }

  async function logDispatch(targetType: string, targetId: string, brokerId: string) {
    if (!supabase) return;
    try {
      await (supabase as any).from("interaction_logs").insert({
        id: crypto.randomUUID(),
        event_type: "dispatch_to_broker",
        target_type: targetType,
        target_id: targetId,
        broker_profile_id: brokerId,
        created_at: new Date().toISOString(),
      });
    } catch {
      return;
    }
  }

  async function dispatchLeadToBroker() {
    if (!selectedLead) return;

    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    if (!dispatchBrokerId) {
      setErrorMessage("Selecione um corretor para enviar.");
      return;
    }

    setIsDispatching(true);

    try {
      const { error } = await (supabase as any)
        .from("leads")
        .update({ assigned_broker_profile_id: dispatchBrokerId })
        .eq("id", selectedLead.id);

      if (error) {
        setErrorMessage(error.message);
        setIsDispatching(false);
        return;
      }

      void logDispatch("lead", selectedLead.id, dispatchBrokerId);

      setRows((current) =>
        current.map((l) =>
          l.id === selectedLead.id ? { ...l, assigned_broker_profile_id: dispatchBrokerId } : l,
        ),
      );
      setSelectedLead((current) =>
        current ? { ...current, assigned_broker_profile_id: dispatchBrokerId } : current,
      );
    } catch {
      setErrorMessage("Não foi possível enviar ao corretor agora.");
    } finally {
      setIsDispatching(false);
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
      const rich = await supabase
        .from("leads")
        .select(
          "id, full_name, phone, interest, stage, source, assigned_broker_profile_id, created_at, estimated_value, email, message, slug_imovel, intent, address, value_max",
        )
        .order("created_at", { ascending: false });

      if (!rich.error) {
        setRows((rich.data ?? []) as LeadRow[]);
        return;
      }

      const basic = await supabase
        .from("leads")
        .select("id, full_name, phone, interest, stage, source, assigned_broker_profile_id, created_at, intent, address, value_max")
        .order("created_at", { ascending: false });

      if (basic.error) {
        setRows([]);
        setErrorMessage(basic.error.message);
        return;
      }

      setRows((basic.data ?? []) as LeadRow[]);
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

  async function setLeadStage(leadId: string, stage: LeadStage) {
    await moveLead(leadId, stage);

    if (!supabase) return;

    try {
      await (supabase as any).from("lead_events").insert({
        id: crypto.randomUUID(),
        lead_id: leadId,
        event_type: "stage_change",
        notes: stage,
      });
    } catch {
      return;
    }
  }

  async function openLeadModal(lead: LeadRow) {
    setSelectedLead(lead);
    setDispatchBrokerId(lead.assigned_broker_profile_id ?? "");
    setLeadHistory([]);
    setErrorMessage(null);

    setPreferences(null);
    setPreferencesError(null);
    setIsPreferencesLoading(false);
    setLeadBrain(null);

    setSuggestions([]);
    setSuggestionsError(null);
    setIsSuggestionsLoading(false);

    if (!supabase) return;

    setIsHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from("lead_events")
        .select("id, lead_id, event_type, notes, created_at")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false });

      if (error) {
        setLeadHistory([]);
        setIsHistoryLoading(false);
        return;
      }

      setLeadHistory((data ?? []) as LeadEventRow[]);
      setIsHistoryLoading(false);
    } catch {
      setLeadHistory([]);
      setIsHistoryLoading(false);
    }

    void loadPreferences(lead.id);
    void loadLeadBrain(lead.id);
  }

  async function loadLeadBrain(leadId: string) {
    if (!supabase) return;

    try {
      const res = await (supabase as any)
        .from("leads")
        .select("id, intent, address, value_max")
        .eq("id", leadId)
        .maybeSingle();

      if (res?.error) return;
      const row = res?.data ?? null;
      if (!row) return;

      setLeadBrain({
        lead_id: leadId,
        intent: (row.intent ?? null) as any,
        address: (row.address ?? null) as any,
        value_max: parseMoneyToNumberBR(row.value_max),
      });
    } catch {
      return;
    }
  }

  async function loadPreferences(leadId: string) {
    if (!supabase) return;

    setIsPreferencesLoading(true);
    setPreferencesError(null);

    try {
      const { data, error } = await (supabase as any)
        .from("customer_preferences")
        .select("lead_id, tipo_imovel, valor_max, quartos, bairro, created_at, updated_at")
        .eq("lead_id", leadId)
        .maybeSingle();

      if (error) {
        setPreferences(null);
        setPreferencesError(error.message);
        setIsPreferencesLoading(false);
        return;
      }

      const row = (data ?? null) as CustomerPreferencesRow | null;
      setPreferences(
        row ?? {
          lead_id: leadId,
          tipo_imovel: null,
          valor_max: null,
          quartos: null,
          bairro: null,
        },
      );
      setIsPreferencesLoading(false);
      void loadSuggestions(leadId, row);
    } catch (e: any) {
      setPreferences(null);
      setPreferencesError(e?.message ?? "Falha ao carregar preferências.");
      setIsPreferencesLoading(false);
    }
  }

  async function savePreferences() {
    if (!supabase || !selectedLead || !preferences) return;

    setIsPreferencesSaving(true);
    setPreferencesError(null);

    const payload = {
      lead_id: selectedLead.id,
      tipo_imovel: preferences.tipo_imovel?.trim() ? preferences.tipo_imovel.trim() : null,
      valor_max: typeof preferences.valor_max === "number" && Number.isFinite(preferences.valor_max) ? preferences.valor_max : null,
      quartos: typeof preferences.quartos === "number" && Number.isFinite(preferences.quartos) ? preferences.quartos : null,
      bairro: preferences.bairro?.trim() ? preferences.bairro.trim() : null,
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = await (supabase as any)
        .from("customer_preferences")
        .upsert(payload, { onConflict: "lead_id" });

      if (error) {
        setPreferencesError(error.message);
        setIsPreferencesSaving(false);
        return;
      }

      setIsPreferencesSaving(false);
      void loadSuggestions(selectedLead.id, payload as any);
    } catch (e: any) {
      setPreferencesError(e?.message ?? "Não foi possível salvar as preferências.");
      setIsPreferencesSaving(false);
    }
  }

  async function loadSuggestions(leadId: string, prefs: CustomerPreferencesRow | null | undefined) {
    if (!supabase) return;

    setIsSuggestionsLoading(true);
    setSuggestionsError(null);
    setSuggestions([]);

    try {
      let q = (supabase as any)
        .from("properties")
        .select("id, title, property_type, purpose, price, neighborhood, city, bedrooms, status")
        .eq("status", "disponivel")
        .order("created_at", { ascending: false })
        .limit(24);

      const tipo = String(prefs?.tipo_imovel ?? "").trim();
      const bairro = String(prefs?.bairro ?? "").trim();
      const quartos = typeof prefs?.quartos === "number" ? prefs!.quartos : null;
      const valorMax = typeof prefs?.valor_max === "number" ? prefs!.valor_max : null;

      if (tipo) q = q.ilike("property_type", `%${tipo}%`);
      if (bairro) q = q.ilike("neighborhood", `%${bairro}%`);
      if (quartos != null) q = q.gte("bedrooms", quartos);
      if (valorMax != null) q = q.lte("price", valorMax);

      const { data, error } = await q;
      if (error) {
        setSuggestions([]);
        setSuggestionsError(error.message);
        setIsSuggestionsLoading(false);
        return;
      }

      setSuggestions((data ?? []) as PropertySuggestionRow[]);
      setIsSuggestionsLoading(false);
    } catch (e: any) {
      setSuggestions([]);
      setSuggestionsError(e?.message ?? "Não foi possível carregar sugestões.");
      setIsSuggestionsLoading(false);
    }
  }

  function closeLeadModal() {
    setSelectedLead(null);
    setLeadHistory([]);
    setIsHistoryLoading(false);

    setPreferences(null);
    setPreferencesError(null);
    setIsPreferencesLoading(false);
    setIsPreferencesSaving(false);

    setLeadBrain(null);

    setSuggestions([]);
    setSuggestionsError(null);
    setIsSuggestionsLoading(false);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl px-6 py-6">
        <div className="flex items-center justify-between gap-4">
          <div className="text-xl font-semibold tracking-tight text-slate-900">Leads</div>

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-[0_10px_24px_-18px_rgba(16,185,129,0.55)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Novo Lead
          </button>
        </div>

        <div className="mt-5 rounded-2xl bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.08)] ring-1 ring-slate-200/70">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
              <div className="relative w-full md:max-w-[360px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-11 w-full rounded-xl bg-white pl-10 pr-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                  placeholder="Buscar..."
                />
              </div>

              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="h-11 w-full rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10 md:w-[220px]"
              >
                <option value="">Origem</option>
                {uniqueSources.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                value={brokerFilter}
                onChange={(e) => setBrokerFilter(e.target.value)}
                className="h-11 w-full rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10 md:w-[240px]"
              >
                <option value="">Corretor</option>
                {brokers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.full_name ?? "-"}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.08)] ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </button>
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-5 rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200/70">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {columns.map((col) => {
            const items = filtered.filter((l) => col.stages.includes(l.stage));
            return (
              <div key={col.key} className="flex min-h-[70vh] flex-col rounded-2xl">
                <div className={"flex items-center justify-between rounded-t-2xl px-4 py-3 text-white " + col.headerCls}>
                  <div className="text-sm font-semibold">{col.label}</div>
                  <div className="text-xs font-semibold tabular-nums">{items.length}</div>
                </div>
                <div className="flex flex-1 flex-col gap-3 rounded-b-2xl bg-white p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.08)] ring-1 ring-slate-200/70">
                  {items.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center rounded-xl bg-slate-50 px-4 py-10 text-center ring-1 ring-slate-200/70">
                      <div className="text-xs font-semibold tracking-wide text-slate-500">Sem leads</div>
                    </div>
                  ) : null}

                  {items.map((lead) => {
                    const cardLead = lead;
                    const icon = sourceIconName(lead.source);
                    const SourceIcon = icon === "search" ? Search : icon === "whatsapp" ? MessageCircle : Globe;

                    const intentLabel =
                      cardLead.intent === "comprar" ? "Compra" : cardLead.intent === "alugar" ? "Aluguel" : "";
                    const bairro = cardLead.address ? inferBairroFromAddress(String(cardLead.address)) : "";
                    const valueMax = parseMoneyToNumberBR(cardLead.value_max);
                    const sourceText = sourceLabel(cardLead.source);

                    const digits = sanitizePhone(cardLead.phone);
                    const waDigits = digits.startsWith("55") ? digits : digits ? `55${digits}` : "";
                    const waHref = waDigits ? `https://wa.me/${waDigits}` : "";
                    const telHref = digits ? `tel:${digits}` : "";

                    const canPrev = col.key !== "novo";
                    const canNext = col.key !== "ganho";

                    const prevStage: LeadStage = col.key === "atendimento" ? "recebido" : "atendimento";
                    const nextStage: LeadStage = col.key === "novo" ? "atendimento" : "vendido";

                    return (
                      <div
                        key={lead.id}
                        className="rounded-2xl bg-white p-4 shadow-[0_8px_18px_-16px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/70"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => void openLeadModal({ ...cardLead })}
                            className="min-w-0 text-left"
                          >
                            <div className="truncate text-sm font-semibold text-slate-900">{cardLead.full_name}</div>
                            {sourceText ? (
                              <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                                <SourceIcon className="h-3.5 w-3.5 text-slate-400" />
                                <span className="truncate">{sourceText}</span>
                              </div>
                            ) : null}
                          </button>

                          <div className="flex shrink-0 flex-col items-end gap-2">
                            {typeof cardLead.estimated_value === "number" ? (
                              <div className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-800 ring-1 ring-slate-200/70">
                                <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                                {formatCurrencyBRL(cardLead.estimated_value)}
                              </div>
                            ) : null}

                            {sourceText ? (
                              <span
                                className={
                                  "inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 " +
                                  sourceBadgeCls(cardLead.source)
                                }
                              >
                                {sourceText.slice(0, 14)}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {intentLabel || bairro || valueMax != null ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {intentLabel ? (
                              <span className="inline-flex items-center justify-center rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-200/70">
                                {intentLabel}
                              </span>
                            ) : null}
                            {bairro ? (
                              <span className="inline-flex items-center justify-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200/70">
                                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                                <span className="truncate">Local: {bairro}</span>
                              </span>
                            ) : null}
                            {valueMax != null ? (
                              <span className="inline-flex items-center justify-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200/70">
                                {formatCurrencyBRL(valueMax)}
                              </span>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="mt-3 flex items-center justify-between gap-3">
                          {cardLead.slug_imovel || cardLead.interest ? (
                            <span className="inline-flex max-w-[70%] items-center justify-center truncate rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200/70">
                              {cardLead.slug_imovel ?? cardLead.interest}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">&nbsp;</span>
                          )}

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => void openLeadModal({ ...cardLead })}
                              className="inline-flex h-9 items-center justify-center rounded-xl bg-white px-3 text-[12px] font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50"
                            >
                              Ver Detalhes
                            </button>
                            <a
                              href={waHref}
                              target="_blank"
                              rel="noreferrer"
                              className={
                                "inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1 transition-all duration-300 " +
                                (waHref
                                  ? "bg-green-500 text-white ring-green-600/20 hover:-translate-y-[1px] hover:bg-green-600"
                                  : "bg-slate-50 text-slate-300 ring-slate-200/70 pointer-events-none")
                              }
                              aria-label="Abrir WhatsApp"
                              title="WhatsApp"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </a>
                            <a
                              href={telHref}
                              className={
                                "inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1 transition-all duration-300 " +
                                (telHref
                                  ? "bg-slate-900 text-white ring-slate-900/10 hover:-translate-y-[1px]"
                                  : "bg-slate-50 text-slate-300 ring-slate-200/70 pointer-events-none")
                              }
                              aria-label="Ligar"
                              title="Telefone"
                            >
                              <Phone className="h-4 w-4" />
                            </a>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <div className="text-[11px] text-slate-500">
                            {cardLead.assigned_broker_profile_id
                              ? brokerById.get(cardLead.assigned_broker_profile_id)?.full_name ?? "-"
                              : "-"}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={!canPrev || movingLeadId === lead.id}
                              onClick={() => void setLeadStage(lead.id, prevStage)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-700 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label="Voltar etapa"
                              title="Voltar"
                            >
                              <ArrowLeft className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={!canNext || movingLeadId === lead.id}
                              onClick={() => void setLeadStage(lead.id, nextStage)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-700 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label="Avançar etapa"
                              title="Avançar"
                            >
                              <ArrowRight className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedLead ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 px-4 py-8"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeLeadModal();
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-[0_24px_64px_-20px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/70">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-6 border-b border-slate-100 bg-white px-6 py-5">
              <div className="min-w-0">
                <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">
                  LEAD
                </div>
                <div className="mt-2 truncate text-xl font-semibold text-slate-900">
                  {selectedLead.full_name}
                </div>
                <div className="mt-1 text-sm text-slate-600">{selectedLead.phone}</div>
              </div>

              <button
                type="button"
                onClick={() => closeLeadModal()}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-600 ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={
                    "inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ring-1 " +
                    sourceBadgeCls(selectedLead.source)
                  }
                >
                  {selectedLead.source ?? "Outros"}
                </span>
              </div>

              {selectedLead.interest ? (
                <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200/70">
                  <span className="font-semibold text-slate-900">Interesse:</span> {selectedLead.interest}
                </div>
              ) : null}

              <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200/70">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">MATCHING</div>
                    <div className="mt-1 text-sm font-semibold text-[#001f3f]">Preferências do Cliente</div>
                    <div className="mt-1 text-xs text-slate-500">Base para sugerir imóveis automaticamente.</div>
                  </div>
                </div>

                {preferencesError ? (
                  <div className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900 ring-1 ring-amber-200/70">
                    {preferencesError}
                  </div>
                ) : null}

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Tipo do imóvel</span>
                    <input
                      value={
                        preferences?.tipo_imovel ??
                        (leadBrain?.lead_id === selectedLead.id
                          ? leadBrain.intent === "comprar"
                            ? "Compra"
                            : leadBrain.intent === "alugar"
                              ? "Aluguel"
                              : ""
                          : "")
                      }
                      onChange={(e) =>
                        setPreferences((s) =>
                          s
                            ? {
                                ...s,
                                tipo_imovel: e.target.value,
                              }
                            : s,
                        )
                      }
                      disabled={isPreferencesLoading}
                      className="h-11 w-full rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15 disabled:opacity-60"
                      placeholder="Ex: Apartamento"
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Bairro</span>
                    <input
                      value={
                        preferences?.bairro ??
                        (leadBrain?.lead_id === selectedLead.id ? inferBairroFromAddress(leadBrain.address ?? "") : "")
                      }
                      onChange={(e) =>
                        setPreferences((s) =>
                          s
                            ? {
                                ...s,
                                bairro: e.target.value,
                              }
                            : s,
                        )
                      }
                      disabled={isPreferencesLoading}
                      className="h-11 w-full rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15 disabled:opacity-60"
                      placeholder="Ex: Centro"
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Quartos (mín.)</span>
                    <input
                      value={preferences?.quartos != null ? String(preferences.quartos) : ""}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        const n = raw ? Number(raw) : null;
                        setPreferences((s) =>
                          s
                            ? {
                                ...s,
                                quartos: n != null && Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : null,
                              }
                            : s,
                        );
                      }}
                      disabled={isPreferencesLoading}
                      inputMode="numeric"
                      className="h-11 w-full rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15 disabled:opacity-60"
                      placeholder="Ex: 2"
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Valor máximo</span>
                    <input
                      value={
                        preferences?.valor_max != null
                          ? formatCurrencyBRL(preferences.valor_max)
                          : leadBrain?.lead_id === selectedLead.id && leadBrain.value_max != null
                            ? formatCurrencyBRL(leadBrain.value_max)
                            : ""
                      }
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        const n = raw ? parseMoneyToNumberBR(raw) : null;
                        setPreferences((s) =>
                          s
                            ? {
                                ...s,
                                valor_max: n != null && Number.isFinite(n) ? Math.max(0, n) : null,
                              }
                            : s,
                        );
                      }}
                      disabled={isPreferencesLoading}
                      inputMode="decimal"
                      className="h-11 w-full rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15 disabled:opacity-60"
                      placeholder="Ex: 450000"
                    />
                  </label>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => void savePreferences()}
                    disabled={isPreferencesSaving || isPreferencesLoading || !preferences}
                    className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#001f3f] px-5 text-sm font-semibold text-white shadow-[0_6px_14px_-10px_rgba(15,23,42,0.45)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#001a33] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPreferencesSaving ? "Salvando..." : "Salvar preferências"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedLead) return;
                      void loadSuggestions(selectedLead.id, preferences);
                    }}
                    disabled={isSuggestionsLoading || isPreferencesLoading}
                    className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSuggestionsLoading ? "Buscando..." : "Atualizar sugestões"}
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-white ring-1 ring-slate-200/70">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <div className="text-sm font-semibold text-slate-900">Imóveis sugeridos para este perfil</div>
                  <div className="text-xs text-slate-500">
                    {isSuggestionsLoading ? "Atualizando..." : `${suggestions.length} sugestão(ões)`}
                  </div>
                </div>
                <div className="max-h-64 overflow-auto px-4 py-3">
                  {suggestionsError ? (
                    <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200/70">
                      {suggestionsError}
                    </div>
                  ) : suggestions.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {suggestions.slice(0, 10).map((p) => (
                        <div
                          key={p.id}
                          className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200/70"
                        >
                          <div className="text-xs font-semibold tracking-wide text-slate-600">
                            {p.property_type ?? "Imóvel"}
                            {p.neighborhood ? ` • ${p.neighborhood}` : ""}
                            {p.city ? ` • ${p.city}` : ""}
                          </div>
                          <div className="mt-1 text-sm font-semibold text-slate-900">{p.title ?? "-"}</div>
                          <div className="mt-1 text-[11px] text-slate-600">
                            {typeof p.price === "number" ? formatCurrencyBRL(p.price) : "Preço: -"}
                            {typeof p.bedrooms === "number" ? ` • ${p.bedrooms} qtos` : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-slate-50 px-4 py-6 text-sm text-slate-600 ring-1 ring-slate-200/70">
                      Nenhuma sugestão no momento. Preencha as preferências e tente novamente.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200/70">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">
                      GESTÃO DE FLUXO
                    </div>
                    <div className="mt-1 text-sm font-semibold text-[#001f3f]">
                      Enviar ao Corretor
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Atualiza o lead e registra log do envio.
                    </div>
                  </div>
                  {selectedLead.assigned_broker_profile_id ? (
                    <span className="inline-flex h-8 items-center justify-center rounded-full bg-slate-50 px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70">
                      Enviado
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <select
                    value={dispatchBrokerId}
                    onChange={(e) => setDispatchBrokerId(e.target.value)}
                    className="h-11 w-full rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15 sm:col-span-2"
                  >
                    <option value="">Selecione um corretor</option>
                    {brokers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.full_name ?? b.id}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => void dispatchLeadToBroker()}
                    disabled={isDispatching || !dispatchBrokerId}
                    className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#001f3f] px-5 text-sm font-semibold text-white shadow-[0_6px_14px_-10px_rgba(15,23,42,0.45)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#001a33] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isDispatching ? "Enviando..." : "Confirmar"}
                  </button>
                </div>

                <div className="mt-3 text-xs text-slate-600">
                  Atual:{" "}
                  <span className="font-semibold text-slate-900">
                    {(() => {
                      const id = selectedLead.assigned_broker_profile_id ?? "";
                      if (!id) return "-";
                      return brokerById.get(id)?.full_name ?? id;
                    })()}
                  </span>
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-white ring-1 ring-slate-200/70">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <div className="text-sm font-semibold text-slate-900">Histórico</div>
                  <div className="text-xs text-slate-500">
                    {isHistoryLoading ? "Atualizando..." : `${leadHistory.length} eventos`}
                  </div>
                </div>
                <div className="max-h-64 overflow-auto px-4 py-3">
                  {leadHistory.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {leadHistory.map((ev) => (
                        <div
                          key={ev.id}
                          className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200/70"
                        >
                          <div className="text-xs font-semibold tracking-wide text-slate-600">
                            {ev.event_type ?? "evento"}
                          </div>
                          <div className="mt-1 text-sm text-slate-900">{ev.notes ?? "-"}</div>
                          <div className="mt-1 text-[11px] text-slate-500">{ev.created_at ?? ""}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-slate-50 px-4 py-6 text-sm text-slate-600 ring-1 ring-slate-200/70">
                      Sem histórico disponível.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 z-10 border-t border-slate-100 bg-white px-6 py-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <a
                  href={`https://wa.me/${sanitizePhone(selectedLead.phone)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-[0_6px_16px_-10px_rgba(16,185,129,0.55)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-emerald-700"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={movingLeadId === selectedLead.id}
                    onClick={() => void setLeadStage(selectedLead.id, prevStage(selectedLead.stage))}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </button>
                  <button
                    type="button"
                    disabled={movingLeadId === selectedLead.id}
                    onClick={() => void setLeadStage(selectedLead.id, nextStage(selectedLead.stage))}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#001f3f] px-4 text-sm font-semibold text-white shadow-[0_6px_16px_-10px_rgba(15,23,42,0.45)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#001a33] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Avançar
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isCreateOpen ? (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setIsCreateOpen(false)}
            aria-hidden="true"
          />

          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.75)] ring-1 ring-slate-200/70">
            <div className="flex items-center justify-between gap-4">
              <div className="text-base font-semibold text-slate-900">Novo Lead</div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-700 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-100"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={(e) => {
                void createLead(e as any);
                setIsCreateOpen(false);
              }}
              className="mt-5 flex flex-col gap-4"
            >
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold tracking-wide text-slate-600">Nome</span>
                <input
                  value={form.full_name}
                  onChange={(e) => setForm((s) => ({ ...s, full_name: e.target.value }))}
                  className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                  required
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold tracking-wide text-slate-600">Telefone</span>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                  className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                  required
                  inputMode="tel"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold tracking-wide text-slate-600">Imóvel de interesse</span>
                <input
                  value={form.interest}
                  onChange={(e) => setForm((s) => ({ ...s, interest: e.target.value }))}
                  className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold tracking-wide text-slate-600">Origem</span>
                <input
                  value={form.source}
                  onChange={(e) => setForm((s) => ({ ...s, source: e.target.value }))}
                  className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                />
              </label>

              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-[0_10px_24px_-18px_rgba(16,185,129,0.55)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                {isSaving ? "Salvando..." : "Criar"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
