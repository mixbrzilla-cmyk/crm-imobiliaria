"use client";

import { useEffect, useMemo, useState } from "react";

import {
  BadgeCheck,
  Building2,
  Camera,
  Droplets,
  FileText,
  Image as ImageIcon,
  Lightbulb,
  MapPin,
  Plus,
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

  progress_percent?: number | null;

  is_premium?: boolean | null;

  status?: DevelopmentStatus | null;
  lot_value?: number | null;
  preco?: number | null;

  total_area_m2?: number | null;
  lots_count?: number | null;
  green_area_m2?: number | null;

  units_count?: number | null;

  infra_asphalt?: boolean | null;
  infra_power?: boolean | null;
  infra_water?: boolean | null;
  infra_sewage?: boolean | null;

  infra_leisure?: boolean | null;

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

  progress_percent: string;

  total_area_m2: string;
  lots_count: string;
  green_area_m2: string;

  units_count: string;

  infra_asphalt: boolean;
  infra_power: boolean;
  infra_water: boolean;
  infra_sewage: boolean;

  infra_leisure: boolean;

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

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.trunc(n)));
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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<0 | 1 | 2 | 3>(0);

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
    progress_percent: "",
    total_area_m2: "",
    lots_count: "",
    green_area_m2: "",
    units_count: "",
    infra_asphalt: false,
    infra_power: false,
    infra_water: false,
    infra_sewage: false,
    infra_leisure: false,
    gallery_urls: "",
    cover_url: "",
    video_url: "",
    sales_material_url: "",
    price_table_url: "",
  });

  function resetForm() {
    setSelectedId(null);
    setActiveTab("basicos");
    setModalStep(0);
    setForm({
      name: "",
      city: "Marabá",
      corretor_id: "",
      is_premium: false,
      status: "pre_lancamento",
      lot_value: "",
      progress_percent: "",
      total_area_m2: "",
      lots_count: "",
      green_area_m2: "",
      units_count: "",
      infra_asphalt: false,
      infra_power: false,
      infra_water: false,
      infra_sewage: false,
      infra_leisure: false,
      gallery_urls: "",
      cover_url: "",
      video_url: "",
      sales_material_url: "",
      price_table_url: "",
    });
  }

  function openNewModal() {
    setErrorMessage(null);
    resetForm();
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setModalStep(0);
  }

  function editRow(row: Development) {
    setSelectedId(row.id);
    setActiveTab("basicos");
    setModalStep(0);
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
      progress_percent: row.progress_percent != null ? String(row.progress_percent) : "",
      total_area_m2: row.total_area_m2 != null ? String(row.total_area_m2) : "",
      lots_count: row.lots_count != null ? String(row.lots_count) : "",
      green_area_m2: row.green_area_m2 != null ? String(row.green_area_m2) : "",
      units_count: row.units_count != null ? String(row.units_count) : "",
      infra_asphalt: Boolean(row.infra_asphalt),
      infra_power: Boolean(row.infra_power),
      infra_water: Boolean(row.infra_water),
      infra_sewage: Boolean(row.infra_sewage),
      infra_leisure: Boolean(row.infra_leisure),
      gallery_urls: (row.gallery_urls ?? []).join("\n"),
      cover_url: row.cover_url ?? "",
      video_url: row.video_url ?? "",
      sales_material_url: row.sales_material_url ?? "",
      price_table_url: row.price_table_url ?? "",
    });
    setErrorMessage(null);
    setIsModalOpen(true);
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
      const fullSelect =
        "id, name, cover_url, video_url, sales_material_url, price_table_url, city, localidade, is_premium, status, lot_value, preco, progress_percent, total_area_m2, lots_count, green_area_m2, units_count, infra_asphalt, infra_power, infra_water, infra_sewage, infra_leisure, gallery_urls, corretor_id, created_at";

      let res = await supabase.from("developments").select(fullSelect).order("created_at", { ascending: false });

      if (res.error) {
        const code = (res.error as any)?.code;
        if (code === "PGRST204" || code === "PGRST301") {
          await testProfilesConnection("load(developments)", res.error);
        }

        const fallbackSelect =
          "id, name, cover_url, video_url, sales_material_url, price_table_url, city, localidade, is_premium, status, lot_value, preco, corretor_id, created_at";
        const fallback = await supabase
          .from("developments")
          .select(fallbackSelect)
          .order("created_at", { ascending: false });

        if (fallback.error) throw fallback.error;
        setSupportsDetails(false);
        setRows((fallback.data ?? []) as Development[]);
      } else {
        setSupportsDetails(true);
        setRows((res.data ?? []) as Development[]);
      }
    } catch (e) {
      console.log("DEBUG SUPABASE:", e);
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
      progress_percent: (() => {
        const raw = form.progress_percent.trim();
        if (!raw) return null;
        const n = Number(raw);
        return Number.isFinite(n) ? clampInt(n, 0, 100) : null;
      })(),
      total_area_m2: parseOptionalNumber(form.total_area_m2),
      lots_count: parseOptionalInt(form.lots_count),
      green_area_m2: parseOptionalNumber(form.green_area_m2),
      units_count: parseOptionalInt(form.units_count),
      infra_asphalt: form.infra_asphalt,
      infra_power: form.infra_power,
      infra_water: form.infra_water,
      infra_sewage: form.infra_sewage,
      infra_leisure: form.infra_leisure,
      gallery_urls: gallery.length ? gallery : null,
    };

    try {
      const query = (supabase as any).from("developments");
      const res = selectedId
        ? await query.update(detailsPayload).eq("id", selectedId)
        : await query.insert(detailsPayload);

      if (res.error) throw res.error;

      setIsSaving(false);
      closeModal();
      resetForm();
      await load();
      return;
    } catch (e) {
      console.log("DEBUG SUPABASE:", e);
      setErrorMessage("Não foi possível salvar o empreendimento agora.");
      setIsSaving(false);
    }
  }

  function getDisplayValue(dev: Development) {
    if (typeof dev.lot_value === "number") return formatBRLIntl(dev.lot_value);
    if (typeof dev.preco === "number") return formatBRLIntl(dev.preco);
    return "-";
  }

  function getLocationLabel(dev: Development) {
    const c = (dev.city ?? "").trim();
    const l = (dev.localidade ?? "").trim();
    return c || l ? [c, l].filter(Boolean).join(" • ") : "Local não informado";
  }

  function progressLabel(dev: Development) {
    const p = dev.progress_percent;
    if (typeof p === "number" && Number.isFinite(p)) return `${clampInt(p, 0, 100)}%`;
    return null;
  }

  function progressCls(dev: Development) {
    const p = dev.progress_percent;
    if (typeof p !== "number" || !Number.isFinite(p)) return "bg-slate-50 text-slate-700 ring-slate-200/70";
    if (p >= 80) return "bg-emerald-50 text-emerald-800 ring-emerald-200/70";
    if (p >= 40) return "bg-amber-50 text-amber-900 ring-amber-200/70";
    return "bg-rose-50 text-rose-800 ring-rose-200/70";
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="rounded-2xl bg-gradient-to-r from-[#001f3f] via-slate-900 to-[#ff0000] px-6 py-5 text-center shadow-[0_10px_24px_-14px_rgba(15,23,42,0.55)] ring-1 ring-slate-200/70">
        <div className="text-[11px] font-semibold tracking-[0.28em] text-white/80">VALIDAÇÃO VISUAL</div>
        <div className="mt-1 text-2xl font-semibold tracking-tight text-white">ESTILO VITRINE ATIVADO</div>
      </div>

      <header className="flex flex-col gap-4">
        <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">LANÇAMENTOS</div>
        <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Empreendimentos</h1>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Portfólio de lançamentos com ficha técnica, infraestrutura e mídia de impacto.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-slate-900 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50"
            >
              Recarregar
            </button>
            <button
              type="button"
              onClick={() => openNewModal()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#ff0000] px-5 text-sm font-semibold text-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.20)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#e60000]"
            >
              <Plus className="h-4 w-4" />
              Novo Empreendimento
            </button>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {isLoading ? (
          <div className="rounded-2xl bg-white px-6 py-8 text-sm text-slate-600 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70 lg:col-span-3">
            Carregando empreendimentos...
          </div>
        ) : rows.length > 0 ? (
          rows.map((r) => {
            const infraCount =
              (r.infra_asphalt ? 1 : 0) +
              (r.infra_power ? 1 : 0) +
              (r.infra_water ? 1 : 0) +
              (r.infra_sewage ? 1 : 0) +
              (r.infra_leisure ? 1 : 0);
            const progress = progressLabel(r);
            const value = getDisplayValue(r);
            return (
              <div
                key={r.id}
                className="group overflow-hidden rounded-2xl bg-white shadow-[0_10px_24px_-14px_rgba(15,23,42,0.55)] ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[2px]"
              >
                <div className="relative h-40 w-full bg-gradient-to-br from-slate-900 to-[#001f3f]">
                  {r.cover_url ? (
                    <img src={r.cover_url} alt={r.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/70">
                      <ImageIcon className="h-10 w-10" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/25 to-transparent" />

                  <div className="absolute left-4 top-4 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-900 ring-1 ring-white/40">
                      <Building2 className="h-3.5 w-3.5" />
                      {statusLabel[(r.status ?? "pre_lancamento") as DevelopmentStatus]}
                    </span>
                    {progress ? (
                      <span className={"inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 " + progressCls(r)}>
                        {progress} concluído
                      </span>
                    ) : null}
                  </div>

                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="truncate text-lg font-semibold text-white">{r.name}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs font-medium text-white/80">
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="truncate">{getLocationLabel(r)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-500">
                        VALOR
                      </div>
                      <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="inline-flex items-center justify-center rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70">
                        Infra: {infraCount}/5
                      </span>
                      {r.is_premium ? (
                        <span className="inline-flex items-center justify-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200/70">
                          Premium
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {r.infra_asphalt ? (
                      <span className={"inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ring-1 " + infraBadgeCls(true)}>
                        <Route className="h-3.5 w-3.5" /> Asfalto
                      </span>
                    ) : null}
                    {r.infra_power ? (
                      <span className={"inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ring-1 " + infraBadgeCls(true)}>
                        <Lightbulb className="h-3.5 w-3.5" /> Energia
                      </span>
                    ) : null}
                    {r.infra_leisure ? (
                      <span className={"inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ring-1 " + infraBadgeCls(true)}>
                        <Waves className="h-3.5 w-3.5" /> Lazer
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => editRow(r)}
                      className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(r.id);
                        setDispatchSelectionById((c) => ({ ...c, [r.id]: r.corretor_id ?? "" }));
                        setIsModalOpen(true);
                        setModalStep(0);
                      }}
                      className="inline-flex h-11 items-center justify-center rounded-xl bg-[#001f3f] px-4 text-sm font-semibold text-white shadow-[0_6px_14px_-10px_rgba(15,23,42,0.45)] transition-all duration-300 hover:bg-[#001a33]"
                    >
                      Abrir
                    </button>
                  </div>

                  <div className="mt-4 text-xs text-slate-500">
                    {r.video_url ? "Vídeo disponível" : "Sem vídeo"} • {r.sales_material_url ? "Material OK" : "Sem material"}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl bg-white px-6 py-10 text-sm text-slate-600 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70 lg:col-span-3">
            Nenhum empreendimento cadastrado.
          </div>
        )}
      </section>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_-24px_rgba(15,23,42,0.65)] ring-1 ring-slate-200/70">
            <div className="flex items-start justify-between gap-6 border-b border-slate-100 px-6 py-5">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {selectedId ? "Editar Empreendimento" : "Novo Empreendimento"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Etapa {modalStep + 1} de 4 • Dados completos do lançamento
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  closeModal();
                  setErrorMessage(null);
                }}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>

            {errorMessage ? (
              <div className="px-6 pt-5">
                <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200/70">
                  {errorMessage}
                </div>
              </div>
            ) : null}

            {!supportsDetails ? (
              <div className="px-6 pt-5">
                <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200/70">
                  Alguns campos técnicos ainda não existem no banco. Você já pode cadastrar o básico e depois
                  completamos.
                </div>
              </div>
            ) : null}

            <form onSubmit={createDevelopment} className="px-6 py-6">
              <div className="grid grid-cols-4 gap-2 rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200/70">
                {(
                  [
                    { idx: 0 as const, label: "Dados Básicos", icon: <Tag className="h-4 w-4" /> },
                    { idx: 1 as const, label: "Ficha Técnica", icon: <FileText className="h-4 w-4" /> },
                    { idx: 2 as const, label: "Infraestrutura", icon: <Route className="h-4 w-4" /> },
                    { idx: 3 as const, label: "Mídia & Docs", icon: <Camera className="h-4 w-4" /> },
                  ] as Array<{ idx: 0 | 1 | 2 | 3; label: string; icon: React.ReactNode }>
                ).map((t) => {
                  const isActive = t.idx === modalStep;
                  return (
                    <button
                      key={t.idx}
                      type="button"
                      onClick={() => setModalStep(t.idx)}
                      className={
                        "flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-[11px] font-semibold transition-all duration-300 " +
                        (isActive
                          ? "bg-white text-slate-900 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70"
                          : "text-slate-600 hover:bg-white/70")
                      }
                    >
                      {t.icon}
                      <span className="hidden sm:inline">{t.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 flex flex-col gap-4">
                {modalStep === 0 ? (
                  <>
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold tracking-wide text-slate-600">Nome</span>
                      <input
                        value={form.name}
                        onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                        className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                        placeholder="Ex: Residencial / Loteamento"
                        required
                      />
                    </label>

                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold tracking-wide text-slate-600">Local</span>
                      <div className="relative">
                        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          value={form.city}
                          onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
                          className="h-11 w-full rounded-xl bg-white pl-10 pr-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                          placeholder="Cidade / Bairro"
                        />
                      </div>
                    </label>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold tracking-wide text-slate-600">Valor do Lote / Global</span>
                        <input
                          value={form.lot_value}
                          onChange={(e) => setForm((s) => ({ ...s, lot_value: formatBRLInput(e.target.value) }))}
                          className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                          placeholder="R$ 0,00"
                          inputMode="decimal"
                        />
                      </label>

                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold tracking-wide text-slate-600">Progresso da Obra (%)</span>
                        <input
                          value={form.progress_percent}
                          onChange={(e) => setForm((s) => ({ ...s, progress_percent: e.target.value }))}
                          className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                          placeholder="0 a 100"
                          inputMode="numeric"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold tracking-wide text-slate-600">Status</span>
                        <select
                          value={form.status}
                          onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as DevelopmentStatus }))}
                          className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                        >
                          <option value="pre_lancamento">{statusLabel.pre_lancamento}</option>
                          <option value="em_obras">{statusLabel.em_obras}</option>
                          <option value="pronto_para_construir">{statusLabel.pronto_para_construir}</option>
                        </select>
                      </label>
                    </div>

                    <label className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-slate-200/70">
                      <input
                        type="checkbox"
                        checked={form.is_premium}
                        onChange={(e) => setForm((s) => ({ ...s, is_premium: e.target.checked }))}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">Marcar como Premium</span>
                    </label>
                  </>
                ) : null}

                {modalStep === 1 ? (
                  <>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold tracking-wide text-slate-600">Área total (m²)</span>
                        <input
                          value={form.total_area_m2}
                          onChange={(e) => setForm((s) => ({ ...s, total_area_m2: e.target.value }))}
                          className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                          placeholder="0"
                          inputMode="decimal"
                        />
                      </label>
                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold tracking-wide text-slate-600">Lotes</span>
                        <input
                          value={form.lots_count}
                          onChange={(e) => setForm((s) => ({ ...s, lots_count: e.target.value }))}
                          className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                          placeholder="0"
                          inputMode="numeric"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold tracking-wide text-slate-600">Unidades</span>
                        <input
                          value={form.units_count}
                          onChange={(e) => setForm((s) => ({ ...s, units_count: e.target.value }))}
                          className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                          placeholder="0"
                          inputMode="numeric"
                        />
                      </label>
                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold tracking-wide text-slate-600">Área verde (m²)</span>
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
                    </div>
                  </>
                ) : null}

                {modalStep === 2 ? (
                  <>
                    <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
                      <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">INFRAESTRUTURA</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">O que esse lançamento entrega</div>
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
                          Energia
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm((s) => ({ ...s, infra_leisure: !s.infra_leisure }))}
                          className={
                            "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ring-1 transition-all duration-300 hover:-translate-y-[1px] " +
                            infraBadgeCls(form.infra_leisure)
                          }
                        >
                          <Waves className="h-4 w-4" />
                          Lazer
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
                      </div>
                    </div>
                  </>
                ) : null}

                {modalStep === 3 ? (
                  <>
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold tracking-wide text-slate-600">Imagem de Capa (URL)</span>
                      <div className="relative">
                        <ImageIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          value={form.cover_url}
                          onChange={(e) => setForm((s) => ({ ...s, cover_url: e.target.value }))}
                          className="h-11 w-full rounded-xl bg-white pl-10 pr-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                          placeholder="https://..."
                        />
                      </div>
                    </label>

                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold tracking-wide text-slate-600">Link de Vídeo</span>
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
                      <span className="text-xs font-semibold tracking-wide text-slate-600">Galeria (1 URL por linha)</span>
                      <textarea
                        value={form.gallery_urls}
                        onChange={(e) => setForm((s) => ({ ...s, gallery_urls: e.target.value }))}
                        className="min-h-28 rounded-xl bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                        placeholder="https://..."
                      />
                    </label>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold tracking-wide text-slate-600">Material de Venda</span>
                        <input
                          value={form.sales_material_url}
                          onChange={(e) => setForm((s) => ({ ...s, sales_material_url: e.target.value }))}
                          className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                          placeholder="https://..."
                        />
                      </label>
                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold tracking-wide text-slate-600">Tabela de Preços</span>
                        <input
                          value={form.price_table_url}
                          onChange={(e) => setForm((s) => ({ ...s, price_table_url: e.target.value }))}
                          className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                          placeholder="https://..."
                        />
                      </label>
                    </div>
                  </>
                ) : null}
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalStep((s) => (s > 0 ? ((s - 1) as 0 | 1 | 2 | 3) : s))}
                    disabled={modalStep === 0}
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalStep((s) => (s < 3 ? ((s + 1) as 0 | 1 | 2 | 3) : s))}
                    disabled={modalStep === 3}
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.20)] transition-all duration-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Próximo
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => resetForm()}
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50"
                  >
                    Limpar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#ff0000] px-6 text-sm font-semibold text-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.20)] transition-all duration-300 hover:bg-[#e60000] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <BadgeCheck className="h-4 w-4" />
                    {isSaving ? "Salvando..." : selectedId ? "Atualizar" : "Cadastrar"}
                  </button>
                </div>
              </div>

              {selectedId ? (
                <div className="mt-6 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
                  <div className="text-sm font-semibold text-slate-900">Enviar ao Corretor</div>
                  <div className="mt-1 text-xs text-slate-500">Distribuição manual do lançamento.</div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                    <select
                      value={dispatchSelectionById[selectedId] ?? ""}
                      onChange={(e) => setDispatchSelectionById((c) => ({ ...c, [selectedId]: e.target.value }))}
                      className="h-11 w-full rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
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
                      onClick={() => void dispatchToBroker(selectedId)}
                      disabled={dispatchingId === selectedId}
                      className="inline-flex h-11 items-center justify-center rounded-xl bg-[#001f3f] px-5 text-sm font-semibold text-white shadow-[0_6px_14px_-10px_rgba(15,23,42,0.45)] transition-all duration-300 hover:bg-[#001a33] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {dispatchingId === selectedId ? "Enviando..." : "Confirmar"}
                    </button>
                  </div>
                </div>
              ) : null}
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
