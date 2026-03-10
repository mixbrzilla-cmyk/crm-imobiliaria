"use client";

import { useEffect, useMemo, useState } from "react";

import {
  BadgeCheck,
  Camera,
  Droplets,
  FileText,
  Lightbulb,
  MapPin,
  Route,
  Tag,
  Trees,
  Video,
  Waves,
} from "lucide-react";

import { getSupabaseClient } from "@/lib/supabaseClient";
import { formatBRLInput, formatCurrencyBRL, parseBRLInputToNumber } from "@/lib/brl";

type DevelopmentStatus = "pre_lancamento" | "em_obras" | "pronto_para_construir";

type Development = {
  id: string;
  name: string;
  cover_url: string | null;
  video_url: string | null;
  sales_material_url: string | null;
  price_table_url: string | null;
  city?: string | null;
  localidade?: string | null;

  is_premium?: boolean | null;

  status?: DevelopmentStatus | null;
  lot_value?: number | null;
  preco?: number | null;

  total_area_m2?: number | null;
  lots_count?: number | null;
  green_area_m2?: number | null;

  infra_asphalt?: boolean | null;
  infra_power?: boolean | null;
  infra_water?: boolean | null;
  infra_sewage?: boolean | null;

  gallery_urls?: string[] | null;

  corretor_id?: string | null;
  created_at?: string;
};

type BrokerProfile = {
  id: string;
  full_name: string | null;
  status: string | null;
  status_aprovacao?: string | null;
  role?: string | null;
};

type FormState = {
  name: string;
  city: string;
  corretor_id: string;
  is_premium: boolean;

  status: DevelopmentStatus;
  lot_value: string;

  total_area_m2: string;
  lots_count: string;
  green_area_m2: string;

  infra_asphalt: boolean;
  infra_power: boolean;
  infra_water: boolean;
  infra_sewage: boolean;

  gallery_urls: string;

  cover_url: string;
  video_url: string;
  sales_material_url: string;
  price_table_url: string;
};

type TabKey = "basicos" | "tecnicos" | "infra" | "midia" | "status";

const statusLabel: Record<DevelopmentStatus, string> = {
  pre_lancamento: "Pré-lançamento",
  em_obras: "Em Obras",
  pronto_para_construir: "Pronto para Construir",
};

function formatBRLIntl(value: number) {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  } catch {
    return `R$ ${value}`;
  }
}

function parseOptionalInt(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function infraBadgeCls(active: boolean) {
  return active
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200/70"
    : "bg-slate-50 text-slate-600 ring-slate-200/70";
}

export default function EmpreendimentosClient() {
  const supabase = getSupabaseClient();
  const [rows, setRows] = useState<Development[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("basicos");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [brokers, setBrokers] = useState<BrokerProfile[]>([]);
  const [dispatchSelectionById, setDispatchSelectionById] = useState<Record<string, string>>({});
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);

  const [supportsDetails, setSupportsDetails] = useState(true);

  const brokerById = useMemo(() => {
    const map = new Map<string, BrokerProfile>();
    for (const b of brokers) map.set(b.id, b);
    return map;
  }, [brokers]);

  async function testProfilesConnection(context: string, error: unknown) {
    if (!supabase) return;
    try {
      const errAny = error as any;
      console.log("[Supabase Diagnostic]", {
        context,
        code: errAny?.code,
        message: errAny?.message,
        details: errAny?.details,
        hint: errAny?.hint,
      });
      const res = await supabase.from("profiles").select("id").limit(1);
      if (res.error) {
        console.log("DEBUG SUPABASE:", res.error);
        console.log("[Supabase Diagnostic] profiles query failed:", res.error);
      } else {
        console.log("[Supabase Diagnostic] profiles query OK:", {
          hasRow: (res.data ?? []).length > 0,
        });
      }
    } catch (e) {
      console.log("[Supabase Diagnostic] profiles query threw:", e);
    }
  }

  const [form, setForm] = useState<FormState>({
    name: "",
    city: "Marabá",
    corretor_id: "",
    is_premium: false,
    status: "pre_lancamento",
    lot_value: "",
    total_area_m2: "",
    lots_count: "",
    green_area_m2: "",
    infra_asphalt: false,
    infra_power: false,
    infra_water: false,
    infra_sewage: false,
    gallery_urls: "",
    cover_url: "",
    video_url: "",
    sales_material_url: "",
    price_table_url: "",
  });

  function resetForm() {
    setSelectedId(null);
    setActiveTab("basicos");
    setForm({
      name: "",
      city: "Marabá",
      corretor_id: "",
      is_premium: false,
      status: "pre_lancamento",
      lot_value: "",
      total_area_m2: "",
      lots_count: "",
      green_area_m2: "",
      infra_asphalt: false,
      infra_power: false,
      infra_water: false,
      infra_sewage: false,
      gallery_urls: "",
      cover_url: "",
      video_url: "",
      sales_material_url: "",
      price_table_url: "",
    });
  }

  function editRow(row: Development) {
    setSelectedId(row.id);
    setActiveTab("basicos");
    setForm({
      name: row.name ?? "",
      city: row.city ?? "Marabá",
      corretor_id: row.corretor_id ?? "",
      is_premium: Boolean(row.is_premium),
      status: (row.status ?? "pre_lancamento") as DevelopmentStatus,
      lot_value:
        typeof row.lot_value === "number"
          ? formatCurrencyBRL(row.lot_value, { maximumFractionDigits: 2 })
          : typeof row.preco === "number"
            ? formatCurrencyBRL(row.preco, { maximumFractionDigits: 2 })
          : "",
      total_area_m2: row.total_area_m2 != null ? String(row.total_area_m2) : "",
      lots_count: row.lots_count != null ? String(row.lots_count) : "",
      green_area_m2: row.green_area_m2 != null ? String(row.green_area_m2) : "",
      infra_asphalt: Boolean(row.infra_asphalt),
      infra_power: Boolean(row.infra_power),
      infra_water: Boolean(row.infra_water),
      infra_sewage: Boolean(row.infra_sewage),
      gallery_urls: (row.gallery_urls ?? []).join("\n"),
      cover_url: row.cover_url ?? "",
      video_url: row.video_url ?? "",
      sales_material_url: row.sales_material_url ?? "",
      price_table_url: row.price_table_url ?? "",
    });
  }

  async function load() {
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

    try {
      const res = await supabase
        .from("developments")
        .select(
          "id, name, cover_url, video_url, sales_material_url, price_table_url, city, localidade, is_premium, status, lot_value, preco, total_area_m2, lots_count, green_area_m2, infra_asphalt, infra_power, infra_water, infra_sewage, gallery_urls, corretor_id, created_at",
        )
        .order("created_at", { ascending: false });

      if (res.error) {
        const code = (res.error as any)?.code;
        if (code === "PGRST204" || code === "PGRST301") {
          await testProfilesConnection("load(developments)", res.error);
        }
        throw res.error;
      }
      setSupportsDetails(true);
      setRows((res.data ?? []) as Development[]);
    } catch (e) {
      console.log("DEBUG SUPABASE:", e);
      setErrorMessage("Não foi possível carregar empreendimentos agora.");
      setRows([]);
      setSupportsDetails(false);
    }

    setIsLoading(false);
  }

  async function loadBrokers() {
    if (!supabase) {
      setBrokers([]);
      return;
    }

    try {
      let res: any = await supabase
        .from("profiles")
        .select("id, full_name, status, status_aprovacao, role")
        .eq("role", "broker")
        .order("full_name", { ascending: true });

      if (res.error) {
        res = await supabase
          .from("profiles")
          .select("id, full_name, status, role")
          .eq("role", "broker")
          .order("full_name", { ascending: true });
      }

      if (res.error) {
        console.log("DEBUG SUPABASE:", res.error);
        setBrokers([]);
        return;
      }

      const all = (res.data ?? []) as BrokerProfile[];
      const eligible = all.filter((b) => {
        const status = (b.status ?? "").toLowerCase();
        const aprov = (b.status_aprovacao ?? "").toLowerCase();
        if (aprov) return aprov === "aprovado";
        return status === "ativo" || status === "aprovado";
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

  async function dispatchToBroker(developmentId: string) {
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    const brokerId = (dispatchSelectionById[developmentId] ?? "").trim();
    if (!brokerId) {
      setErrorMessage("Selecione um corretor.");
      return;
    }

    setDispatchingId(developmentId);

    try {
      const { error } = await (supabase as any)
        .from("developments")
        .update({ corretor_id: brokerId })
        .eq("id", developmentId);

      if (error) {
        console.log("DEBUG SUPABASE:", error);
        setErrorMessage(error.message);
        setDispatchingId(null);
        return;
      }

      void logDispatch("development", developmentId, brokerId);

      setRows((current) => current.map((r) => (r.id === developmentId ? { ...r, corretor_id: brokerId } : r)));
    } catch {
      setErrorMessage("Não foi possível enviar ao corretor agora.");
    } finally {
      setDispatchingId(null);
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void load();
      void loadBrokers();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const exists = rows.some((r) => r.id === selectedId);
    if (!exists) setSelectedId(null);
  }, [rows, selectedId]);

  async function createDevelopment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    setIsSaving(true);

    const gallery = form.gallery_urls
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const basePayload: any = {
      id: selectedId ?? crypto.randomUUID(),
      name: form.name.trim(),
      cover_url: form.cover_url.trim() ? form.cover_url.trim() : null,
      video_url: form.video_url.trim() ? form.video_url.trim() : null,
      sales_material_url: form.sales_material_url.trim() ? form.sales_material_url.trim() : null,
      price_table_url: form.price_table_url.trim() ? form.price_table_url.trim() : null,
    };

    const detailsPayload: any = {
      ...basePayload,
      city: form.city.trim() ? form.city.trim() : null,
      corretor_id: form.corretor_id.trim() ? form.corretor_id.trim() : null,
      is_premium: form.is_premium,
      status: form.status,
      lot_value: parseBRLInputToNumber(form.lot_value),
      total_area_m2: parseOptionalNumber(form.total_area_m2),
      lots_count: parseOptionalInt(form.lots_count),
      green_area_m2: parseOptionalNumber(form.green_area_m2),
      infra_asphalt: form.infra_asphalt,
      infra_power: form.infra_power,
      infra_water: form.infra_water,
      infra_sewage: form.infra_sewage,
      gallery_urls: gallery.length ? gallery : null,
    };

    try {
      const query = (supabase as any).from("developments");
      const res = selectedId
        ? await query.update(detailsPayload).eq("id", selectedId)
        : await query.insert(detailsPayload);

      if (res.error) throw res.error;

      setIsSaving(false);
      resetForm();
      await load();
      return;
    } catch (e) {
      console.log("DEBUG SUPABASE:", e);
      setErrorMessage("Não foi possível salvar o empreendimento agora.");
      setIsSaving(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">LANÇAMENTOS</div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Empreendimentos</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          Lançamentos e loteamentos com ficha técnica, infraestrutura e mídia de impacto.
        </p>
      </header>

      {errorMessage ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {!supportsDetails ? (
        <div className="rounded-2xl bg-amber-50 px-5 py-4 text-sm text-amber-800 ring-1 ring-amber-200/70">
          Campos técnicos avançados não estão disponíveis no banco ainda. O painel continua operando no modo
          básico.
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {selectedId ? "Editar empreendimento" : "Novo empreendimento"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Loteamento/Lançamento com ficha técnica, status e infraestrutura.
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void load()}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50"
                >
                  Recarregar
                </button>
                <button
                  type="button"
                  onClick={() => resetForm()}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.20)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-800"
                >
                  Limpar
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200/70">
              {(
                [
                  { key: "basicos", label: "Básicos", icon: <Tag className="h-4 w-4" /> },
                  { key: "tecnicos", label: "Técnico", icon: <FileText className="h-4 w-4" /> },
                  { key: "infra", label: "Infra", icon: <Route className="h-4 w-4" /> },
                  { key: "midia", label: "Mídia", icon: <Camera className="h-4 w-4" /> },
                  { key: "status", label: "Status", icon: <BadgeCheck className="h-4 w-4" /> },
                ] as Array<{ key: TabKey; label: string; icon: React.ReactNode }>
              ).map((t) => {
                const isActive = t.key === activeTab;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setActiveTab(t.key)}
                    className={
                      "flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-300 " +
                      (isActive
                        ? "bg-white text-slate-900 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70"
                        : "text-slate-600 hover:bg-white/70")
                    }
                  >
                    {t.icon}
                    {t.label}
                  </button>
                );
              })}
            </div>

            <form onSubmit={createDevelopment} className="mt-5 flex flex-col gap-4">
              {activeTab === "basicos" ? (
                <>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Nome do Empreendimento</span>
                    <input
                      value={form.name}
                      onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                      placeholder="Ex: Residencial / Loteamento"
                      required
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Cidade</span>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={form.city}
                        onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
                        className="h-11 w-full rounded-xl bg-white pl-10 pr-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                        placeholder="Ex: Marabá"
                      />
                    </div>
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Corretor responsável</span>
                    <select
                      value={form.corretor_id}
                      onChange={(e) => setForm((s) => ({ ...s, corretor_id: e.target.value }))}
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                    >
                      <option value="">Sem corretor</option>
                      {brokers.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.full_name ?? b.id}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-slate-200/70">
                    <input
                      type="checkbox"
                      checked={form.is_premium}
                      onChange={(e) => setForm((s) => ({ ...s, is_premium: e.target.checked }))}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">Marcar como Imóvel Premium (Destaque Dashboard)</span>
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Valor do Lote (ou Global)</span>
                    <input
                      value={form.lot_value}
                      onChange={(e) => setForm((s) => ({ ...s, lot_value: formatBRLInput(e.target.value) }))}
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                      placeholder="R$ 0,00"
                      inputMode="decimal"
                    />
                  </label>
                </>
              ) : null}

              {activeTab === "tecnicos" ? (
                <>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold tracking-wide text-slate-600">Metragem Total (m²)</span>
                      <input
                        value={form.total_area_m2}
                        onChange={(e) => setForm((s) => ({ ...s, total_area_m2: e.target.value }))}
                        className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                        placeholder="0"
                        inputMode="decimal"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold tracking-wide text-slate-600">Quantidade de Lotes</span>
                      <input
                        value={form.lots_count}
                        onChange={(e) => setForm((s) => ({ ...s, lots_count: e.target.value }))}
                        className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                        placeholder="0"
                        inputMode="numeric"
                      />
                    </label>
                  </div>

                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Área Verde (m²)</span>
                    <div className="relative">
                      <Trees className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={form.green_area_m2}
                        onChange={(e) => setForm((s) => ({ ...s, green_area_m2: e.target.value }))}
                        className="h-11 w-full rounded-xl bg-white pl-10 pr-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                        placeholder="0"
                        inputMode="decimal"
                      />
                    </div>
                  </label>
                </>
              ) : null}

              {activeTab === "infra" ? (
                <>
                  <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
                    <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">INFRAESTRUTURA</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">Infraestrutura completa</div>
                    <div className="mt-1 text-xs text-slate-500">Marque o que o loteamento entrega.</div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setForm((s) => ({ ...s, infra_asphalt: !s.infra_asphalt }))}
                        className={
                          "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ring-1 transition-all duration-300 hover:-translate-y-[1px] " +
                          infraBadgeCls(form.infra_asphalt)
                        }
                      >
                        <Route className="h-4 w-4" />
                        Asfalto
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((s) => ({ ...s, infra_power: !s.infra_power }))}
                        className={
                          "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ring-1 transition-all duration-300 hover:-translate-y-[1px] " +
                          infraBadgeCls(form.infra_power)
                        }
                      >
                        <Lightbulb className="h-4 w-4" />
                        Luz
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((s) => ({ ...s, infra_water: !s.infra_water }))}
                        className={
                          "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ring-1 transition-all duration-300 hover:-translate-y-[1px] " +
                          infraBadgeCls(form.infra_water)
                        }
                      >
                        <Droplets className="h-4 w-4" />
                        Água
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((s) => ({ ...s, infra_sewage: !s.infra_sewage }))}
                        className={
                          "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ring-1 transition-all duration-300 hover:-translate-y-[1px] " +
                          infraBadgeCls(form.infra_sewage)
                        }
                      >
                        <Waves className="h-4 w-4" />
                        Esgoto
                      </button>
                    </div>
                  </div>
                </>
              ) : null}

              {activeTab === "midia" ? (
                <>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Imagem de Capa (URL)</span>
                    <input
                      value={form.cover_url}
                      onChange={(e) => setForm((s) => ({ ...s, cover_url: e.target.value }))}
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                      placeholder="https://..."
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Link de Vídeo (Drone/Apresentação)</span>
                    <div className="relative">
                      <Video className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={form.video_url}
                        onChange={(e) => setForm((s) => ({ ...s, video_url: e.target.value }))}
                        className="h-11 w-full rounded-xl bg-white pl-10 pr-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                        placeholder="https://youtube.com/..."
                      />
                    </div>
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Galeria (1 URL por linha) — plantas/perspectivas 3D</span>
                    <textarea
                      value={form.gallery_urls}
                      onChange={(e) => setForm((s) => ({ ...s, gallery_urls: e.target.value }))}
                      className="min-h-28 rounded-xl bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                      placeholder="https://..."
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Material de Venda (Drive/Dropbox)</span>
                    <input
                      value={form.sales_material_url}
                      onChange={(e) => setForm((s) => ({ ...s, sales_material_url: e.target.value }))}
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                      placeholder="https://..."
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Tabela de Preços (URL)</span>
                    <input
                      value={form.price_table_url}
                      onChange={(e) => setForm((s) => ({ ...s, price_table_url: e.target.value }))}
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                      placeholder="https://..."
                    />
                  </label>
                </>
              ) : null}

              {activeTab === "status" ? (
                <>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Status do Lançamento</span>
                    <select
                      value={form.status}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, status: e.target.value as DevelopmentStatus }))
                      }
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                    >
                      <option value="pre_lancamento">{statusLabel.pre_lancamento}</option>
                      <option value="em_obras">{statusLabel.em_obras}</option>
                      <option value="pronto_para_construir">{statusLabel.pronto_para_construir}</option>
                    </select>
                  </label>

                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200/70">
                    <span className="font-semibold text-slate-900">Resumo:</span> {statusLabel[form.status]}
                  </div>
                </>
              ) : null}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#ff0000] px-5 text-sm font-semibold text-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.20)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#e60000] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <BadgeCheck className="h-4 w-4" />
                  {isSaving ? "Salvando..." : selectedId ? "Atualizar" : "Cadastrar"}
                </button>
              </div>
            </form>
          </div>

          <div className="mt-6 rounded-2xl bg-white p-5 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
            <div className="text-sm font-semibold text-slate-900">Enviar ao Corretor</div>
            <div className="mt-1 text-xs text-slate-500">Distribuição manual do lançamento.</div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <select
                value={selectedId ? dispatchSelectionById[selectedId] ?? "" : ""}
                onChange={(e) => {
                  if (!selectedId) return;
                  setDispatchSelectionById((c) => ({ ...c, [selectedId]: e.target.value }));
                }}
                disabled={!selectedId}
                className="h-11 w-full rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15 disabled:cursor-not-allowed disabled:bg-slate-50"
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
                onClick={() => (selectedId ? void dispatchToBroker(selectedId) : null)}
                disabled={!selectedId || dispatchingId === selectedId}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#001f3f] px-5 text-sm font-semibold text-white shadow-[0_6px_14px_-10px_rgba(15,23,42,0.45)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#001a33] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {dispatchingId === selectedId ? "Enviando..." : "Confirmar"}
              </button>
            </div>

            <div className="mt-3 text-xs text-slate-600">
              Atual:{" "}
              <span className="font-semibold text-slate-900">
                {(() => {
                  const current = selectedId ? rows.find((r) => r.id === selectedId) : null;
                  const id = current?.corretor_id ?? "";
                  if (!id) return "-";
                  return brokerById.get(id)?.full_name ?? id;
                })()}
              </span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-sm font-semibold text-slate-900">Empreendimentos cadastrados</div>
                <div className="mt-1 text-xs text-slate-500">{rows.length} registros</div>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">
                      Empreendimento
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">
                      Local
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">
                      Valor
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">
                      Infra
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">
                      Status
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold tracking-wide text-slate-700">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td className="px-5 py-10 text-sm text-slate-600" colSpan={6}>
                        Carregando...
                      </td>
                    </tr>
                  ) : rows.length > 0 ? (
                    rows.map((r) => {
                      const infraCount =
                        (r.infra_asphalt ? 1 : 0) +
                        (r.infra_power ? 1 : 0) +
                        (r.infra_water ? 1 : 0) +
                        (r.infra_sewage ? 1 : 0);
                      const isActive = selectedId === r.id;
                      return (
                        <tr
                          key={r.id}
                          className={
                            "border-t border-slate-100 transition-all duration-300 hover:bg-slate-50/60 " +
                            (isActive ? "bg-slate-50/70" : "")
                          }
                        >
                          <td className="px-5 py-4 text-sm text-slate-900">
                            <div className="font-semibold">{r.name}</div>
                            {r.video_url ? (
                              <a
                                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#001f3f] underline decoration-[#ff0000]/40 underline-offset-4"
                                href={r.video_url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Video className="h-3.5 w-3.5" />
                                Vídeo
                              </a>
                            ) : null}
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-700">
                            {r.city ?? r.localidade ?? "-"}
                          </td>
                          <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                            {typeof r.lot_value === "number"
                              ? formatBRLIntl(r.lot_value)
                              : typeof r.preco === "number"
                                ? formatBRLIntl(r.preco)
                                : "-"}
                          </td>
                          <td className="px-5 py-4 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center justify-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70">
                                {infraCount}/4
                              </span>
                              <div className="flex items-center gap-1 text-slate-500">
                                {r.infra_asphalt ? <Route className="h-4 w-4" /> : null}
                                {r.infra_power ? <Lightbulb className="h-4 w-4" /> : null}
                                {r.infra_water ? <Droplets className="h-4 w-4" /> : null}
                                {r.infra_sewage ? <Waves className="h-4 w-4" /> : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center justify-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70">
                              {statusLabel[(r.status ?? "pre_lancamento") as DevelopmentStatus]}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => editRow(r)}
                                className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedId(r.id)}
                                className="inline-flex h-10 items-center justify-center rounded-xl bg-[#001f3f] px-4 text-sm font-semibold text-white shadow-[0_6px_14px_-10px_rgba(15,23,42,0.45)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#001a33]"
                              >
                                Selecionar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="px-5 py-10 text-sm text-slate-600" colSpan={6}>
                        Nenhum empreendimento cadastrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
