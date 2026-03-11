"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  BadgeCheck,
  Camera,
  CarFront,
  Cuboid,
  Ruler,
  FileText,
  Home,
  Layers,
  Link as LinkIcon,
  MapPin,
  Plus,
  Search,
  SlidersHorizontal,
  Tag,
  X,
} from "lucide-react";

import { getSupabaseClient } from "@/lib/supabaseClient";
import { formatBRLInput, formatCurrencyBRL, parseBRLInputToNumber } from "@/lib/brl";

type PropertyStatus =
  | "rascunho"
  | "disponivel"
  | "reservado"
  | "vendido"
  | "alugado"
  | "inativo";

type PropertyPurpose = "venda" | "locacao";

type PropertyRow = {
  id: string;
  title: string | null;
  property_type: string | null;
  purpose: PropertyPurpose | null;
  price: number | null;
  is_premium?: boolean | null;
  corretor_id?: string | null;
  data_direcionamento?: string | null;
  neighborhood: string | null;
  city: string | null;
  bedrooms: number | null;
  suites: number | null;
  bathrooms: number | null;
  parking_spots: number | null;
  area_m2: number | null;
  photos_urls: string[] | null;
  tour_url: string | null;
  status: PropertyStatus | null;
  description: string | null;
  created_at?: string;
};

type FormState = {
  title: string;
  property_type: string;
  purpose: PropertyPurpose;
  price: string;
  neighborhood: string;
  city: string;
  corretor_id: string;
  is_premium: boolean;
  bedrooms: string;
  suites: string;
  bathrooms: string;
  parking_spots: string;
  area_m2: string;
  photos_urls: string;
  tour_url: string;
  status: PropertyStatus;
  description: string;
};

const statusLabel: Record<PropertyStatus, string> = {
  rascunho: "Rascunho",
  disponivel: "Disponível",
  reservado: "Reservado",
  vendido: "Vendido",
  alugado: "Alugado",
  inativo: "Inativo",
};

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

function Badge({ status }: { status: PropertyStatus }) {
  const cls =
    status === "disponivel"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200/70"
      : status === "reservado"
        ? "bg-amber-50 text-amber-700 ring-amber-200/70"
        : status === "vendido" || status === "alugado"
          ? "bg-slate-100 text-slate-700 ring-slate-200/70"
          : status === "inativo"
            ? "bg-rose-50 text-rose-700 ring-rose-200/70"
            : "bg-slate-50 text-slate-600 ring-slate-200/70";

  return (
    <span
      className={
        "inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 " +
        cls
      }
    >
      {statusLabel[status]}
    </span>
  );
}

type TabKey = "basicos" | "caracteristicas" | "midia" | "status";

type BrokerProfile = {
  id: string;
  full_name: string | null;
  status: string | null;
  status_aprovacao?: string | null;
  role?: string | null;
};

export default function InventarioImoveisPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [propertiesBrokerColumn, setPropertiesBrokerColumn] = useState<"corretor_id" | "broker_id">("corretor_id");

  const [activeTab, setActiveTab] = useState<TabKey>("basicos");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [purposeFilter, setPurposeFilter] = useState<"all" | PropertyPurpose>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | PropertyStatus>("all");

  const [rows, setRows] = useState<PropertyRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 8000);
  }, []);

  const [updatingFieldByRowId, setUpdatingFieldByRowId] = useState<Record<string, "corretor" | "premium" | null>>(
    {},
  );

  const [brokers, setBrokers] = useState<BrokerProfile[]>([]);

  const [form, setForm] = useState<FormState>({
    title: "",
    property_type: "Apartamento",
    purpose: "venda",
    price: "",
    neighborhood: "",
    city: "",
    corretor_id: "",
    is_premium: false,
    bedrooms: "",
    suites: "",
    bathrooms: "",
    parking_spots: "",
    area_m2: "",
    photos_urls: "",
    tour_url: "",
    status: "disponivel",
    description: "",
  });

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
      const brokerCol = propertiesBrokerColumn;
      const { data, error } = await supabase
        .from("properties")
        .select(
          `id, title, property_type, purpose, price, is_premium, ${brokerCol}, data_direcionamento, neighborhood, city, bedrooms, suites, bathrooms, parking_spots, area_m2, photos_urls, tour_url, status, description, created_at`,
        )
        .order("created_at", { ascending: false });

      if (error) {
        setRows([]);
        setErrorMessage(error.message);
        return;
      }

      setRows((data ?? []) as any);
    } catch {
      try {
        const brokerCol = propertiesBrokerColumn;
        const { data, error } = await supabase
          .from("properties")
          .select(
            `id, title, property_type, purpose, price, is_premium, ${brokerCol}, neighborhood, city, bedrooms, suites, bathrooms, parking_spots, area_m2, photos_urls, tour_url, status, description, created_at`,
          )
          .order("created_at", { ascending: false });
        if (error) {
          setRows([]);
          setErrorMessage(error.message);
          return;
        }
        setRows((data ?? []) as any);
      } catch {
        setRows([]);
        setErrorMessage("Não foi possível carregar o inventário agora.");
      }
    }
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
        .eq("status", "ativo")
        .order("full_name", { ascending: true });

      if (res.error) {
        res = await supabase
          .from("profiles")
          .select("id, full_name, status, role")
          .eq("role", "broker")
          .eq("status", "ativo")
          .order("full_name", { ascending: true });
      }

      if (res.error) {
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

  useEffect(() => {
    void load();
    void loadBrokers();
  }, []);

  useEffect(() => {
    if (!supabase) return;

    const timeoutId = window.setTimeout(async () => {
      try {
        const test = await (supabase as any).from("properties").select("id, broker_id").limit(1);
        if (!test.error) {
          setPropertiesBrokerColumn("broker_id");
        } else {
          setPropertiesBrokerColumn("corretor_id");
        }
      } catch {
        setPropertiesBrokerColumn("corretor_id");
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [supabase]);

  async function updateCorretorInline(rowId: string, brokerId: string) {
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    const nextBrokerId = brokerId || null;
    const nowIso = nextBrokerId ? new Date().toISOString() : null;

    const payload = { [propertiesBrokerColumn]: nextBrokerId, data_direcionamento: nowIso } as any;
    console.log("[Inventário] Salvando corretor/data_direcionamento", { rowId, payload });

    setUpdatingFieldByRowId((c) => ({ ...c, [rowId]: "corretor" }));
    setRows((current) =>
      current.map((r: any) =>
        r.id === rowId ? { ...r, [propertiesBrokerColumn]: nextBrokerId, data_direcionamento: nowIso } : r,
      ),
    );

    try {
      const { error } = await (supabase as any)
        .from("properties")
        .update(payload)
        .eq("id", rowId);

      if (error) {
        console.log("[Inventário] Erro ao salvar corretor/data_direcionamento", { rowId, error, payload });
        const msg = String(error.message ?? "");
        if (msg.toLowerCase().includes("data_direcionamento") && msg.toLowerCase().includes("does not exist")) {
          setErrorMessage(
            'Coluna "data_direcionamento" não existe na tabela properties (ou não está exposta). Crie a coluna (timestamptz) no Supabase e tente novamente.',
          );
        } else if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("rls")) {
          setErrorMessage(
            'Permissão negada ao salvar "data_direcionamento". Verifique RLS/policies da tabela properties para update desse campo.',
          );
        } else {
          setErrorMessage(msg || "Erro ao salvar.");
        }
        await load();
        return;
      }
    } catch {
      console.log("[Inventário] Falha inesperada ao salvar corretor/data_direcionamento", { rowId, payload });
      setErrorMessage("Não foi possível salvar o corretor agora.");
      await load();
    } finally {
      setUpdatingFieldByRowId((c) => ({ ...c, [rowId]: null }));
    }
  }

  async function updatePremiumInline(rowId: string, nextValue: boolean) {
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    setUpdatingFieldByRowId((c) => ({ ...c, [rowId]: "premium" }));
    setRows((current) => current.map((r) => (r.id === rowId ? { ...r, is_premium: nextValue } : r)));

    try {
      const { error } = await (supabase as any)
        .from("properties")
        .update({ is_premium: nextValue })
        .eq("id", rowId);

      if (error) {
        setErrorMessage(error.message);
        await load();
        return;
      }
    } catch {
      setErrorMessage("Não foi possível salvar o premium agora.");
      await load();
    } finally {
      setUpdatingFieldByRowId((c) => ({ ...c, [rowId]: null }));
    }
  }

  function resetForm() {
    setSelectedId(null);
    setActiveTab("basicos");
    setForm({
      title: "",
      property_type: "Apartamento",
      purpose: "venda",
      price: "",
      neighborhood: "",
      city: "",
      corretor_id: "",
      is_premium: false,
      bedrooms: "",
      suites: "",
      bathrooms: "",
      parking_spots: "",
      area_m2: "",
      photos_urls: "",
      tour_url: "",
      status: "disponivel",
      description: "",
    });
  }

  function editRow(row: PropertyRow) {
    setSelectedId(row.id);
    setActiveTab("basicos");
    setForm({
      title: row.title ?? "",
      property_type: row.property_type ?? "Apartamento",
      purpose: (row.purpose ?? "venda") as PropertyPurpose,
      price:
        typeof row.price === "number" ? formatCurrencyBRL(row.price, { maximumFractionDigits: 2 }) : "",
      neighborhood: row.neighborhood ?? "",
      city: row.city ?? "",
      corretor_id: row.corretor_id ?? "",
      is_premium: Boolean(row.is_premium),
      bedrooms: row.bedrooms != null ? String(row.bedrooms) : "",
      suites: row.suites != null ? String(row.suites) : "",
      bathrooms: row.bathrooms != null ? String(row.bathrooms) : "",
      parking_spots: row.parking_spots != null ? String(row.parking_spots) : "",
      area_m2: row.area_m2 != null ? String(row.area_m2) : "",
      photos_urls: (row.photos_urls ?? []).join("\n"),
      tour_url: row.tour_url ?? "",
      status: (row.status ?? "disponivel") as PropertyStatus,
      description: row.description ?? "",
    });

    setIsFormOpen(true);
  }

  function openNew() {
    resetForm();
    setIsFormOpen(true);
  }

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (purposeFilter !== "all" && (r.purpose ?? null) !== purposeFilter) return false;
      if (statusFilter !== "all" && (r.status ?? "disponivel") !== statusFilter) return false;
      if (!q) return true;

      const title = String(r.title ?? "").toLowerCase();
      const neighborhood = String(r.neighborhood ?? "").toLowerCase();
      const city = String(r.city ?? "").toLowerCase();
      const type = String(r.property_type ?? "").toLowerCase();
      return title.includes(q) || neighborhood.includes(q) || city.includes(q) || type.includes(q);
    });
  }, [rows, search, purposeFilter, statusFilter]);

  function purposeLabel(purpose: PropertyPurpose | null) {
    return purpose === "locacao" ? "Aluguel" : "Venda";
  }

  function purposeBadgeCls(purpose: PropertyPurpose | null) {
    return purpose === "locacao"
      ? "bg-sky-50 text-sky-700 ring-sky-200/70"
      : "bg-emerald-50 text-emerald-700 ring-emerald-200/70";
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    setIsSaving(true);

    const photos = form.photos_urls
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const payload = {
      id: selectedId ?? crypto.randomUUID(),
      title: form.title.trim() ? form.title.trim() : null,
      property_type: form.property_type.trim() ? form.property_type.trim() : null,
      purpose: form.purpose,
      price: parseBRLInputToNumber(form.price),
      [propertiesBrokerColumn]: form.corretor_id.trim() ? form.corretor_id.trim() : null,
      is_premium: form.is_premium,
      neighborhood: form.neighborhood.trim() ? form.neighborhood.trim() : null,
      city: form.city.trim() ? form.city.trim() : null,
      bedrooms: parseOptionalInt(form.bedrooms),
      suites: parseOptionalInt(form.suites),
      bathrooms: parseOptionalInt(form.bathrooms),
      parking_spots: parseOptionalInt(form.parking_spots),
      area_m2: parseOptionalNumber(form.area_m2),
      photos_urls: photos.length ? photos : null,
      tour_url: form.tour_url.trim() ? form.tour_url.trim() : null,
      status: form.status,
      description: form.description.trim() ? form.description.trim() : null,
    } as any;

    try {
      const query = (supabase as any).from("properties");
      const { error } = selectedId
        ? await query.update(payload).eq("id", selectedId)
        : await query.insert(payload);

      if (error) throw error;

      setIsSaving(false);
      resetForm();
      setIsFormOpen(false);
      await load();
    } catch {
      try {
        const retryPayload: any = { ...payload };
        delete retryPayload[propertiesBrokerColumn];
        const query = (supabase as any).from("properties");
        const { error } = selectedId
          ? await query.update(retryPayload).eq("id", selectedId)
          : await query.insert(retryPayload);

        if (error) {
          setErrorMessage(error.message);
          setIsSaving(false);
          return;
        }

        setIsSaving(false);
        resetForm();
        setIsFormOpen(false);
        await load();
      } catch {
        setIsSaving(false);
        setErrorMessage("Não foi possível salvar o imóvel agora.");
      }
    }
  }

  async function removeRow(id: string) {
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    setIsDeletingId(id);

    try {
      const { error } = await (supabase as any).from("properties").delete().eq("id", id);
      if (error) {
        const code = (error as any)?.code;
        const details = (error as any)?.details;
        const hint = (error as any)?.hint;
        const message = String(error.message ?? "Erro ao excluir.");
        console.error("[Inventário] DELETE properties falhou", { id, code, details, hint, message, error });
        const full = [message, code ? `code=${code}` : null, details ? `details=${details}` : null, hint ? `hint=${hint}` : null]
          .filter(Boolean)
          .join(" | ");
        setErrorMessage(full);
        showToast(full);
        setIsDeletingId(null);
        return;
      }

      setRows((current) => current.filter((r) => r.id !== id));
      if (selectedId === id) resetForm();
      setIsDeletingId(null);
    } catch {
      console.error("[Inventário] DELETE properties falhou (exception)", { id });
      setErrorMessage("Não foi possível excluir o imóvel agora.");
      showToast("Não foi possível excluir o imóvel agora.");
      setIsDeletingId(null);
    }
  }

  const tabs: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
    {
      key: "basicos",
      label: "Básicos",
      icon: <Tag className="h-4 w-4" />,
    },
    {
      key: "caracteristicas",
      label: "Características",
      icon: <Layers className="h-4 w-4" />,
    },
    {
      key: "midia",
      label: "Mídia",
      icon: <Camera className="h-4 w-4" />,
    },
    {
      key: "status",
      label: "Status",
      icon: <BadgeCheck className="h-4 w-4" />,
    },
  ];

  return (
    <div className="min-h-screen w-full bg-slate-100 px-6 py-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      {toastMessage ? (
        <div className="fixed right-6 top-6 z-50 max-w-[520px] rounded-2xl bg-rose-600 px-5 py-4 text-sm font-semibold text-white shadow-[0_16px_40px_-24px_rgba(0,0,0,0.55)]">
          {toastMessage}
        </div>
      ) : null}

      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">INVENTÁRIO</div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Inventário</h1>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
            <div className="relative w-full md:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 w-full rounded-xl bg-slate-50 pl-10 pr-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#2b6cff]/40"
                placeholder="Buscar por título, bairro, cidade..."
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200/70">
                <SlidersHorizontal className="h-4 w-4 text-slate-500" />
                <select
                  value={purposeFilter}
                  onChange={(e) => setPurposeFilter(e.target.value as any)}
                  className="bg-transparent text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value="all">Finalidade: Todas</option>
                  <option value="venda">Finalidade: Venda</option>
                  <option value="locacao">Finalidade: Aluguel</option>
                </select>
              </div>

              <div className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200/70">
                <SlidersHorizontal className="h-4 w-4 text-slate-500" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-transparent text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value="all">Status: Todos</option>
                  <option value="disponivel">Disponível</option>
                  <option value="reservado">Reservado</option>
                  <option value="vendido">Vendido</option>
                  <option value="alugado">Alugado</option>
                  <option value="rascunho">Rascunho</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50"
            >
              Recarregar
            </button>
            <button
              type="button"
              onClick={() => openNew()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2b6cff] px-5 text-sm font-semibold text-white shadow-[0_10px_26px_-18px_rgba(43,108,255,0.85)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#255fe6]"
            >
              <Plus className="h-4 w-4" />
              Novo Imóvel
            </button>
          </div>
        </div>
      </header>

      {errorMessage ? (
        <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200/70">
          {errorMessage}
        </div>
      ) : null}

      <section className="w-full">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">Vitrine de imóveis</div>
            <div className="mt-1 text-xs text-slate-500">{filteredRows.length} registros</div>
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <div className="mt-5 rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200/70">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <Home className="h-7 w-7" />
            </div>
            <div className="mt-5 text-lg font-semibold tracking-tight text-slate-900">Nenhum imóvel encontrado</div>
            <div className="mt-2 text-sm text-slate-600">Ajuste a busca/filtros ou cadastre um novo imóvel.</div>
            <button
              type="button"
              onClick={() => openNew()}
              className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#2b6cff] px-6 text-sm font-semibold text-white shadow-[0_10px_26px_-18px_rgba(43,108,255,0.85)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#255fe6]"
            >
              <Plus className="h-4 w-4" />
              Cadastrar imóvel
            </button>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-3">
            {filteredRows.map((r) => {
              const photo = (r.photos_urls ?? [])[0] ?? null;
              const title = r.title ?? r.property_type ?? "Imóvel";
              const neighborhood = r.neighborhood ?? "-";
              const city = r.city ?? "";
              const local = city ? `${neighborhood} • ${city}` : neighborhood;
              const price = typeof r.price === "number" ? formatCurrencyBRL(r.price) : "-";
              const area = typeof r.area_m2 === "number" ? `${Math.round(r.area_m2)}m²` : "-";
              const bedrooms = typeof r.bedrooms === "number" ? r.bedrooms : null;
              const suites = typeof r.suites === "number" ? r.suites : null;
              const parking = typeof r.parking_spots === "number" ? r.parking_spots : null;
              const roomsLine =
                bedrooms != null || suites != null
                  ? `${bedrooms ?? 0} qtos | ${suites ?? 0} suíte${(suites ?? 0) === 1 ? "" : "s"}`
                  : "-";
              const parkingLine = parking != null ? `${parking} vaga${parking === 1 ? "" : "s"}` : "-";

              return (
                <div
                  key={r.id}
                  className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[2px] hover:shadow-md"
                >
                  <div className="relative h-44 w-full bg-slate-100">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-500">
                        <Camera className="h-8 w-8" />
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/55 via-slate-950/10 to-transparent" />

                    <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
                      <span
                        className={
                          "inline-flex items-center justify-center gap-1.5 rounded-full bg-white/55 px-3 py-1 text-xs font-semibold text-slate-900 ring-1 ring-white/70 backdrop-blur "
                        }
                      >
                        <Tag className="h-3.5 w-3.5" />
                        {purposeLabel((r.purpose ?? "venda") as PropertyPurpose)}
                      </span>
                      <span className="inline-flex items-center justify-center rounded-full bg-white/55 px-3 py-1 text-xs font-semibold text-slate-900 ring-1 ring-white/70 backdrop-blur">
                        {statusLabel[(r.status ?? "disponivel") as PropertyStatus]}
                      </span>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="text-base font-semibold tracking-tight text-slate-900 line-clamp-2">{title}</div>
                    <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-600">
                      <MapPin className="h-4 w-4 text-slate-500" />
                      <span className="truncate">
                        <span className="text-slate-700">{neighborhood}</span>
                        {city ? <span className="text-slate-500"> • {city}</span> : null}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50/80 p-3 ring-1 ring-slate-200/70">
                      <div className="flex items-center gap-2">
                        <Ruler className="h-4 w-4 text-slate-600" />
                        <div className="text-xs font-semibold text-slate-700">{area}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Cuboid className="h-4 w-4 text-slate-600" />
                        <div className="text-xs font-semibold text-slate-700">{roomsLine}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <CarFront className="h-4 w-4 text-slate-600" />
                        <div className="text-xs font-semibold text-slate-700">{parkingLine}</div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-end justify-between gap-4">
                      <div className="text-lg font-semibold tracking-tight text-emerald-600">{price}</div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => editRow(r)}
                          className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeRow(r.id)}
                          disabled={isDeletingId === r.id}
                          className="inline-flex h-10 items-center justify-center rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isDeletingId === r.id ? "Excluindo..." : "Excluir"}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200/70">
                        <div className="text-[10px] font-semibold tracking-wide text-slate-500">Corretor</div>
                        <select
                          value={r.corretor_id ?? ""}
                          onChange={(e) => void updateCorretorInline(r.id, e.target.value)}
                          disabled={updatingFieldByRowId[r.id] === "corretor"}
                          className="mt-1 h-10 w-full rounded-xl bg-white px-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#2b6cff]/30 disabled:cursor-not-allowed disabled:bg-slate-50"
                        >
                          <option value="">Sem corretor</option>
                          {brokers.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.full_name ?? b.id}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200/70">
                        <div className="text-[10px] font-semibold tracking-wide text-slate-500">Premium</div>
                        <label className="mt-3 inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={Boolean(r.is_premium)}
                            onChange={(e) => void updatePremiumInline(r.id, e.target.checked)}
                            disabled={updatingFieldByRowId[r.id] === "premium"}
                            className="h-4 w-4"
                          />
                          <span className="text-xs font-semibold text-slate-600">
                            {updatingFieldByRowId[r.id] === "premium" ? "Salvando..." : r.is_premium ? "Ativo" : "Inativo"}
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {isFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
          <button
            type="button"
            onClick={() => {
              if (isSaving) return;
              setIsFormOpen(false);
              resetForm();
            }}
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Fechar"
          />

          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200/70"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div>
                <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">NOVO IMÓVEL</div>
                <div className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                  {selectedId ? "Editar imóvel" : "Cadastro passo a passo"}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  1. Dados Básicos · 2. Características · 3. Mídia · 4. Status/Publicação
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (isSaving) return;
                    resetForm();
                  }}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSaving}
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isSaving) return;
                    setIsFormOpen(false);
                    resetForm();
                  }}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-700 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Fechar"
                  disabled={isSaving}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {errorMessage ? (
              <div className="px-6 pt-5">
                <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200/70">
                  {errorMessage}
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-6 px-6 py-6 md:grid-cols-12">
              <div className="md:col-span-3">
                <div className="flex flex-col gap-2 rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200/70">
                  {tabs.map((tab) => {
                    const isActive = tab.key === activeTab;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        className={
                          "flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left text-sm font-semibold transition-all duration-300 " +
                          (isActive
                            ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/70"
                            : "text-slate-600 hover:bg-white/70")
                        }
                      >
                        {tab.icon}
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="md:col-span-9">
                <form onSubmit={save} className="flex flex-col gap-4">
                  {activeTab === "basicos" ? (
                    <>
                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold tracking-wide text-slate-600">Título</span>
                        <input
                          value={form.title}
                          onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                          className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                          placeholder="Ex: Apartamento alto padrão com vista"
                        />
                      </label>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <label className="flex flex-col gap-2">
                          <span className="text-xs font-semibold tracking-wide text-slate-600">Tipo</span>
                          <input
                            value={form.property_type}
                            onChange={(e) => setForm((s) => ({ ...s, property_type: e.target.value }))}
                            className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                            placeholder="Apartamento, Casa, Lote"
                            required
                          />
                        </label>

                        <label className="flex flex-col gap-2">
                          <span className="text-xs font-semibold tracking-wide text-slate-600">Finalidade</span>
                          <select
                            value={form.purpose}
                            onChange={(e) =>
                              setForm((s) => ({ ...s, purpose: e.target.value as PropertyPurpose }))
                            }
                            className="h-11 rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                          >
                            <option value="venda">Venda</option>
                            <option value="locacao">Locação</option>
                          </select>
                        </label>

                        <label className="flex flex-col gap-2">
                          <span className="text-xs font-semibold tracking-wide text-slate-600">Preço</span>
                          <input
                            value={form.price}
                            onChange={(e) => setForm((s) => ({ ...s, price: formatBRLInput(e.target.value) }))}
                            className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                            placeholder="R$ 0,00"
                            inputMode="decimal"
                          />
                        </label>

                        <label className="flex flex-col gap-2">
                          <span className="text-xs font-semibold tracking-wide text-slate-600">Cidade</span>
                          <div className="relative">
                            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                              value={form.city}
                              onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
                              className="h-11 w-full rounded-xl bg-white pl-10 pr-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                              placeholder="Ex: Marabá"
                            />
                          </div>
                        </label>
                      </div>

                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold tracking-wide text-slate-600">Bairro</span>
                        <input
                          value={form.neighborhood}
                          onChange={(e) => setForm((s) => ({ ...s, neighborhood: e.target.value }))}
                          className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                          placeholder="Ex: Moinhos de Vento"
                        />
                      </label>

                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold tracking-wide text-slate-600">Corretor</span>
                        <select
                          value={form.corretor_id}
                          onChange={(e) => setForm((s) => ({ ...s, corretor_id: e.target.value }))}
                          className="h-11 rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                        >
                          <option value="">Sem corretor</option>
                          {brokers.length === 0 ? (
                            <option value="" disabled>
                              Nenhum corretor ativo encontrado
                            </option>
                          ) : (
                            brokers.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.full_name ?? b.id}
                              </option>
                            ))
                          )}
                        </select>
                      </label>
                    </>
                  ) : null}

                  {activeTab === "caracteristicas" ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <label className="flex flex-col gap-2">
                          <span className="text-xs font-semibold tracking-wide text-slate-600">Quartos</span>
                          <input
                            value={form.bedrooms}
                            onChange={(e) => setForm((s) => ({ ...s, bedrooms: e.target.value }))}
                            className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                            inputMode="numeric"
                          />
                        </label>

                        <label className="flex flex-col gap-2">
                          <span className="text-xs font-semibold tracking-wide text-slate-600">Suítes</span>
                          <input
                            value={form.suites}
                            onChange={(e) => setForm((s) => ({ ...s, suites: e.target.value }))}
                            className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                            inputMode="numeric"
                          />
                        </label>

                        <label className="flex flex-col gap-2">
                          <span className="text-xs font-semibold tracking-wide text-slate-600">Banheiros</span>
                          <input
                            value={form.bathrooms}
                            onChange={(e) => setForm((s) => ({ ...s, bathrooms: e.target.value }))}
                            className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                            inputMode="numeric"
                          />
                        </label>

                        <label className="flex flex-col gap-2">
                          <span className="text-xs font-semibold tracking-wide text-slate-600">Vagas</span>
                          <input
                            value={form.parking_spots}
                            onChange={(e) => setForm((s) => ({ ...s, parking_spots: e.target.value }))}
                            className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                            inputMode="numeric"
                          />
                        </label>
                      </div>

                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold tracking-wide text-slate-600">Área (m²)</span>
                        <input
                          value={form.area_m2}
                          onChange={(e) => setForm((s) => ({ ...s, area_m2: e.target.value }))}
                          className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                          inputMode="decimal"
                        />
                      </label>
                    </>
                  ) : null}

                  {activeTab === "midia" ? (
                    <>
                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold tracking-wide text-slate-600">Fotos (1 URL por linha)</span>
                        <textarea
                          value={form.photos_urls}
                          onChange={(e) => setForm((s) => ({ ...s, photos_urls: e.target.value }))}
                          className="min-h-28 rounded-xl bg-white px-4 py-3 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                          placeholder="https://..."
                        />
                      </label>

                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold tracking-wide text-slate-600">Tour virtual / Vídeo (URL)</span>
                        <div className="relative">
                          <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            value={form.tour_url}
                            onChange={(e) => setForm((s) => ({ ...s, tour_url: e.target.value }))}
                            className="h-11 w-full rounded-xl bg-white pl-10 pr-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                            placeholder="https://youtube.com/..."
                          />
                        </div>
                      </label>
                    </>
                  ) : null}

                  {activeTab === "status" ? (
                    <>
                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold tracking-wide text-slate-600">Status</span>
                        <select
                          value={form.status}
                          onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as PropertyStatus }))}
                          className="h-11 rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                        >
                          <option value="disponivel">Disponível</option>
                          <option value="reservado">Reservado</option>
                          <option value="vendido">Vendido</option>
                          <option value="alugado">Alugado</option>
                          <option value="rascunho">Rascunho</option>
                          <option value="inativo">Inativo</option>
                        </select>
                      </label>

                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold tracking-wide text-slate-600">Descrição</span>
                        <div className="relative">
                          <FileText className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                          <textarea
                            value={form.description}
                            onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                            className="min-h-28 w-full rounded-xl bg-white pl-10 pr-4 pt-3 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                          />
                        </div>
                      </label>
                    </>
                  ) : null}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Home className="h-4 w-4" />
                      {isSaving ? "Salvando..." : selectedId ? "Atualizar" : "Cadastrar"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}
