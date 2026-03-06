"use client";

import { useEffect, useMemo, useState } from "react";

import {
  BadgeCheck,
  Camera,
  FileText,
  Home,
  Layers,
  Link as LinkIcon,
  MapPin,
  Tag,
} from "lucide-react";

import { getSupabaseClient } from "@/lib/supabaseClient";

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

function formatCurrencyBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
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

export default function InventarioImoveisPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [activeTab, setActiveTab] = useState<TabKey>("basicos");

  const [rows, setRows] = useState<PropertyRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    title: "",
    property_type: "Apartamento",
    purpose: "venda",
    price: "",
    neighborhood: "",
    city: "",
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
      const { data, error } = await supabase
        .from("properties")
        .select(
          "id, title, property_type, purpose, price, neighborhood, city, bedrooms, suites, bathrooms, parking_spots, area_m2, photos_urls, tour_url, status, description, created_at",
        )
        .order("created_at", { ascending: false });

      if (error) {
        setRows([]);
        setErrorMessage(error.message);
        return;
      }

      setRows((data ?? []) as PropertyRow[]);
    } catch {
      setRows([]);
      setErrorMessage("Não foi possível carregar o inventário agora.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

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
      price: typeof row.price === "number" ? String(row.price) : "",
      neighborhood: row.neighborhood ?? "",
      city: row.city ?? "",
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
      price: parseOptionalNumber(form.price),
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
    };

    try {
      const query = (supabase as any).from("properties");
      const { error } = selectedId
        ? await query.update(payload).eq("id", selectedId)
        : await query.insert(payload);

      if (error) {
        setErrorMessage(error.message);
        setIsSaving(false);
        return;
      }

      setIsSaving(false);
      resetForm();
      await load();
    } catch {
      setIsSaving(false);
      setErrorMessage("Não foi possível salvar o imóvel agora.");
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
        setErrorMessage(error.message);
        setIsDeletingId(null);
        return;
      }

      setRows((current) => current.filter((r) => r.id !== id));
      if (selectedId === id) resetForm();
      setIsDeletingId(null);
    } catch {
      setErrorMessage("Não foi possível excluir o imóvel agora.");
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
    <div className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">
          INVENTÁRIO UNIFICADO
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Imóveis
        </h1>
        <p className="text-sm leading-relaxed text-slate-600">
          Cadastre e gerencie imóveis com estrutura operacional (Básicos, Características, Mídia, Status).
        </p>
      </header>

      {errorMessage ? (
        <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200/70">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {selectedId ? "Editar imóvel" : "Novo imóvel"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Estruture o cadastro como um produto corporativo.
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
              {tabs.map((tab) => {
                const isActive = tab.key === activeTab;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={
                      "flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-300 " +
                      (isActive
                        ? "bg-white text-slate-900 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70"
                        : "text-slate-600 hover:bg-white/70")
                    }
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <form onSubmit={save} className="mt-5 flex flex-col gap-4">
              {activeTab === "basicos" ? (
                <>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">
                      Título
                    </span>
                    <input
                      value={form.title}
                      onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                      placeholder="Ex: Apartamento alto padrão com vista"
                    />
                  </label>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold tracking-wide text-slate-600">
                        Tipo
                      </span>
                      <input
                        value={form.property_type}
                        onChange={(e) =>
                          setForm((s) => ({ ...s, property_type: e.target.value }))
                        }
                        className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                        placeholder="Apartamento, Casa, Lote"
                        required
                      />
                    </label>

                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold tracking-wide text-slate-600">
                        Finalidade
                      </span>
                      <select
                        value={form.purpose}
                        onChange={(e) =>
                          setForm((s) => ({
                            ...s,
                            purpose: e.target.value as PropertyPurpose,
                          }))
                        }
                        className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                      >
                        <option value="venda">Venda</option>
                        <option value="locacao">Locação</option>
                      </select>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold tracking-wide text-slate-600">
                        Preço
                      </span>
                      <input
                        value={form.price}
                        onChange={(e) => setForm((s) => ({ ...s, price: e.target.value }))}
                        className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                        placeholder="Ex: 850000"
                        inputMode="decimal"
                      />
                    </label>

                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold tracking-wide text-slate-600">
                        Cidade
                      </span>
                      <div className="relative">
                        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          value={form.city}
                          onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
                          className="h-11 w-full rounded-xl bg-white pl-10 pr-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                          placeholder="Ex: Porto Alegre"
                        />
                      </div>
                    </label>
                  </div>

                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">
                      Bairro
                    </span>
                    <input
                      value={form.neighborhood}
                      onChange={(e) => setForm((s) => ({ ...s, neighborhood: e.target.value }))}
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                      placeholder="Ex: Moinhos de Vento"
                    />
                  </label>
                </>
              ) : null}

              {activeTab === "caracteristicas" ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold tracking-wide text-slate-600">
                        Quartos
                      </span>
                      <input
                        value={form.bedrooms}
                        onChange={(e) =>
                          setForm((s) => ({ ...s, bedrooms: e.target.value }))
                        }
                        className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                        inputMode="numeric"
                      />
                    </label>

                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold tracking-wide text-slate-600">
                        Suítes
                      </span>
                      <input
                        value={form.suites}
                        onChange={(e) => setForm((s) => ({ ...s, suites: e.target.value }))}
                        className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                        inputMode="numeric"
                      />
                    </label>

                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold tracking-wide text-slate-600">
                        Banheiros
                      </span>
                      <input
                        value={form.bathrooms}
                        onChange={(e) =>
                          setForm((s) => ({ ...s, bathrooms: e.target.value }))
                        }
                        className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                        inputMode="numeric"
                      />
                    </label>

                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold tracking-wide text-slate-600">
                        Vagas
                      </span>
                      <input
                        value={form.parking_spots}
                        onChange={(e) =>
                          setForm((s) => ({ ...s, parking_spots: e.target.value }))
                        }
                        className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                        inputMode="numeric"
                      />
                    </label>
                  </div>

                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">
                      Área (m²)
                    </span>
                    <input
                      value={form.area_m2}
                      onChange={(e) => setForm((s) => ({ ...s, area_m2: e.target.value }))}
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                      inputMode="decimal"
                    />
                  </label>
                </>
              ) : null}

              {activeTab === "midia" ? (
                <>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">
                      Fotos (1 URL por linha)
                    </span>
                    <textarea
                      value={form.photos_urls}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, photos_urls: e.target.value }))
                      }
                      className="min-h-28 rounded-xl bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                      placeholder="https://..."
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">
                      Tour virtual / Vídeo (URL)
                    </span>
                    <div className="relative">
                      <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={form.tour_url}
                        onChange={(e) => setForm((s) => ({ ...s, tour_url: e.target.value }))}
                        className="h-11 w-full rounded-xl bg-white pl-10 pr-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                        placeholder="https://youtube.com/..."
                      />
                    </div>
                  </label>
                </>
              ) : null}

              {activeTab === "status" ? (
                <>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">
                      Status
                    </span>
                    <select
                      value={form.status}
                      onChange={(e) =>
                        setForm((s) => ({
                          ...s,
                          status: e.target.value as PropertyStatus,
                        }))
                      }
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
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
                    <span className="text-xs font-semibold tracking-wide text-slate-600">
                      Descrição
                    </span>
                    <div className="relative">
                      <FileText className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <textarea
                        value={form.description}
                        onChange={(e) =>
                          setForm((s) => ({ ...s, description: e.target.value }))
                        }
                        className="min-h-28 w-full rounded-xl bg-white pl-10 pr-4 pt-3 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                      />
                    </div>
                  </label>
                </>
              ) : null}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.20)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Home className="h-4 w-4" />
                  {isSaving ? "Salvando..." : selectedId ? "Atualizar" : "Cadastrar"}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-sm font-semibold text-slate-900">Imóveis cadastrados</div>
                <div className="mt-1 text-xs text-slate-500">
                  {rows.length} registros
                </div>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">
                      Imóvel
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">
                      Local
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">
                      Preço
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
                  {rows.length > 0 ? (
                    rows.map((r) => (
                      <tr
                        key={r.id}
                        className="border-t border-slate-100 transition-all duration-300 hover:bg-slate-50/60"
                      >
                        <td className="px-5 py-4 text-sm text-slate-900">
                          <div className="font-semibold">
                            {r.title ?? `${r.property_type ?? "Imóvel"} • ${r.purpose ?? "-"}`}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {r.property_type ?? "-"} • {r.purpose ?? "-"}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-700">
                          {(r.neighborhood ?? "-") + (r.city ? ` • ${r.city}` : "")}
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                          {typeof r.price === "number" ? formatCurrencyBRL(r.price) : "-"}
                        </td>
                        <td className="px-5 py-4">
                          <Badge status={(r.status ?? "disponivel") as PropertyStatus} />
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
                              onClick={() => void removeRow(r.id)}
                              disabled={isDeletingId === r.id}
                              className="inline-flex h-10 items-center justify-center rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isDeletingId === r.id ? "Excluindo..." : "Excluir"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-5 py-10 text-sm text-slate-600" colSpan={5}>
                        Nenhum imóvel cadastrado.
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
