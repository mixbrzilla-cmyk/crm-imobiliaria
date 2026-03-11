"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import { BedDouble, Building2, Car, CheckCircle2, MessageCircle, Plus, Ruler, Trash2, X, XCircle } from "lucide-react";

import { getSupabaseClient } from "@/lib/supabaseClient";

type BrokerProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  whatsapp?: string | null;
  creci?: string | null;
  status: string | null;
  role?: string | null;
};

type BrokerRowView = {
  id: string;
  full_name: string;
  email: string;
  whatsapp: string;
  creci: string;
  statusLabel: string;
  isActive: boolean;
  propertiesInHands: number;
  assignedProperties: Array<{
    id: string;
    title: string;
    purpose: string | null;
    data_direcionamento: string | null;
    clicks: number;
    area_m2: number | null;
    bedrooms: number | null;
    parking_spots: number | null;
    neighborhood: string | null;
    city: string | null;
  }>;
  assignedDevelopments: Array<{
    id: string;
    name: string;
    status: string | null;
    units_count: number | null;
    total_area_m2: number | null;
    neighborhood: string | null;
    city: string | null;
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

function approvalBadge(status: string | null) {
  const s = (status ?? "").toLowerCase().trim();
  const isActive = s === "ativo";
  const isPending = !s || s === "pendente" || s === "aguardando";
  if (isActive) {
    return { label: "Ativo", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200/70" };
  }
  if (isPending) {
    return { label: "Pendente", cls: "bg-amber-50 text-amber-800 ring-amber-200/70" };
  }
  return { label: status ?? "-", cls: "bg-slate-100 text-slate-700 ring-slate-200/70" };
}

function initialsFromName(name: string) {
  const parts = (name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "-";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[parts.length - 1]!.slice(0, 1)}`.toUpperCase();
}

function WhatsappIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M16.03 3.2c-7.07 0-12.82 5.75-12.82 12.82 0 2.27.6 4.48 1.73 6.43L3.1 28.8l6.54-1.72a12.76 12.76 0 0 0 6.39 1.72h.01c7.07 0 12.82-5.75 12.82-12.82S23.1 3.2 16.03 3.2Zm7.47 18.18c-.31.87-1.55 1.61-2.48 1.81-.63.14-1.45.25-4.21-.91-3.53-1.46-5.8-5.05-5.98-5.28-.17-.23-1.43-1.9-1.43-3.63 0-1.72.89-2.56 1.21-2.9.31-.35.68-.43.91-.43h.66c.21 0 .5-.08.78.6.31.74 1.06 2.56 1.15 2.74.1.19.16.41.04.66-.12.25-.19.41-.37.63-.18.23-.39.5-.56.66-.19.19-.38.39-.17.76.21.37.93 1.54 1.99 2.49 1.37 1.22 2.52 1.6 2.89 1.78.37.19.58.16.8-.1.21-.25.91-1.06 1.15-1.43.25-.37.5-.31.84-.19.35.12 2.2 1.04 2.58 1.23.37.19.63.29.72.45.08.17.08.93-.23 1.8Z" />
    </svg>
  );
}

export default function CorretoresAdminPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [rows, setRows] = useState<BrokerRowView[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedBrokerId, setSelectedBrokerId] = useState<string | null>(null);
  const [updatingApprovalId, setUpdatingApprovalId] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createWhatsapp, setCreateWhatsapp] = useState("");
  const [createCreci, setCreateCreci] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const selectedBroker = useMemo(() => {
    if (!selectedBrokerId) return null;
    return rows.find((r) => r.id === selectedBrokerId) ?? null;
  }, [rows, selectedBrokerId]);

  async function setBrokerApproval(brokerId: string, nextStatus: "ativo" | "recusado") {
    setErrorMessage(null);
    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    setUpdatingApprovalId(brokerId);
    try {
      const { error } = await supabase.from("profiles").update({ status: nextStatus }).eq("id", brokerId);
      if (error) {
        console.error("[Corretores] Falha ao atualizar status", { brokerId, nextStatus, error });
        setErrorMessage(error.message);
        return;
      }

      setRows((current) =>
        current.map((r) =>
          r.id === brokerId
            ? {
                ...r,
                statusLabel: nextStatus,
                isActive: nextStatus === "ativo",
              }
            : r,
        ),
      );
      await loadBaseData();
      router.refresh();
    } catch {
      setErrorMessage("Não foi possível atualizar o status do corretor agora.");
    } finally {
      setUpdatingApprovalId(null);
    }
  }

  async function handleApprove(brokerId: string) {
    await setBrokerApproval(brokerId, "ativo");
  }

  async function handleDelete(brokerId: string) {
    setErrorMessage(null);
    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    const brokerName = (rows.find((r) => r.id === brokerId)?.full_name ?? "").trim() || brokerId;
    const ok = window.confirm(`Excluir o corretor "${brokerName}"?`);
    if (!ok) return;

    setDeletingId(brokerId);
    try {
      const { error } = await supabase.from("profiles").delete().eq("id", brokerId);
      if (error) {
        console.error("[Corretores] Falha ao excluir", { brokerId, error });
        setErrorMessage(error.message);
        return;
      }

      setRows((current) => current.filter((r) => r.id !== brokerId));
      if (selectedBrokerId === brokerId) setSelectedBrokerId(null);
      router.refresh();
    } catch {
      setErrorMessage("Não foi possível excluir o corretor agora.");
    } finally {
      setDeletingId(null);
    }
  }

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
      .select("id, full_name, email, whatsapp, creci, status, role")
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
    const devsByBroker = new Map<string, BrokerRowView["assignedDevelopments"]>();
    const whatsClicksByBroker = new Map<string, number>();

    let propertiesBrokerColumn: "corretor_id" | "broker_id" = "corretor_id";
    try {
      const brokerIdTest = await (supabase as any).from("properties").select("id, broker_id").limit(1);
      if (!brokerIdTest.error) propertiesBrokerColumn = "broker_id";
    } catch {
      propertiesBrokerColumn = "corretor_id";
    }

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
      const test = await supabase.from("properties").select(`id, ${propertiesBrokerColumn}, ${col}`).limit(1);
      if (!test.error) {
        propertiesClickColumn = col;
        break;
      }
    }

    const propsSelect = propertiesClickColumn
      ? `id, title, purpose, ${propertiesBrokerColumn}, data_direcionamento, ${propertiesClickColumn}, area_m2, bedrooms, parking_spots, neighborhood, city`
      : `id, title, purpose, ${propertiesBrokerColumn}, data_direcionamento, area_m2, bedrooms, parking_spots, neighborhood, city`;

    const propsRes = brokerIds.length
      ? await supabase
          .from("properties")
          .select(propsSelect)
          .in(propertiesBrokerColumn, brokerIds)
          .not(propertiesBrokerColumn, "is", null)
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
      const brokerId = String(row?.[propertiesBrokerColumn] ?? "").trim();
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
        area_m2: typeof row?.area_m2 === "number" ? row.area_m2 : row?.area_m2 != null ? Number(row.area_m2) : null,
        bedrooms: typeof row?.bedrooms === "number" ? row.bedrooms : row?.bedrooms != null ? Number(row.bedrooms) : null,
        parking_spots:
          typeof row?.parking_spots === "number"
            ? row.parking_spots
            : row?.parking_spots != null
              ? Number(row.parking_spots)
              : null,
        neighborhood: row?.neighborhood ?? null,
        city: row?.city ?? null,
      });
      propsByBroker.set(brokerId, list);
      addClicks(brokerId, safeClicks);
    }

    let developmentsBrokerColumn: "corretor_id" | "broker_id" = "broker_id";
    try {
      const test = await (supabase as any).from("developments").select("id, broker_id").limit(1);
      if (test.error) developmentsBrokerColumn = "corretor_id";
    } catch {
      developmentsBrokerColumn = "corretor_id";
    }

    const devsRes = brokerIds.length
      ? await (supabase as any)
          .from("developments")
          .select("*")
          .in(developmentsBrokerColumn, brokerIds)
          .not(developmentsBrokerColumn, "is", null)
          .order("created_at", { ascending: false })
      : { data: [], error: null };

    if (devsRes.error) {
      const fallbackDevs = brokerIds.length
        ? await (supabase as any)
            .from("developments")
            .select("*")
            .in(developmentsBrokerColumn, brokerIds)
            .not(developmentsBrokerColumn, "is", null)
            .order("id", { ascending: false })
        : { data: [], error: null };

      if (fallbackDevs.error) {
        console.error("[Corretores] Falha ao carregar empreendimentos", fallbackDevs.error);
        setErrorMessage(fallbackDevs.error.message);
      } else {
        for (const row of (fallbackDevs.data ?? []) as Array<any>) {
        const brokerId = String(row?.[developmentsBrokerColumn] ?? "").trim();
        if (!brokerId) continue;
        const name = String(row?.name ?? row?.title ?? "").trim() || "-";
        const city = (row?.city ?? row?.cidade ?? null) as string | null;
        const neighborhood = (row?.localidade ?? row?.bairro ?? null) as string | null;
        const list = devsByBroker.get(brokerId) ?? [];
        list.push({
          id: String(row?.id ?? crypto.randomUUID()),
          name,
          status: (row?.status ?? null) as string | null,
          units_count: null,
          total_area_m2: null,
          neighborhood,
          city,
        });
        devsByBroker.set(brokerId, list);
        }
      }
    } else {
      for (const row of (devsRes.data ?? []) as Array<any>) {
        const brokerId = String(row?.[developmentsBrokerColumn] ?? "").trim();
        if (!brokerId) continue;

        const name = String(row?.name ?? row?.title ?? "").trim() || "-";
        const unitsRaw = row?.units_count ?? row?.total_units;
        const units = typeof unitsRaw === "number" ? unitsRaw : unitsRaw != null ? Number(unitsRaw) : null;
        const safeUnits = Number.isFinite(units as any) ? Math.trunc(units as any) : null;

        const areaRaw = row?.total_area_m2 ?? row?.area_total_m2 ?? row?.area_m2;
        const area = typeof areaRaw === "number" ? areaRaw : areaRaw != null ? Number(areaRaw) : null;
        const safeArea = Number.isFinite(area as any) ? (area as any) : null;

        const city = (row?.city ?? row?.cidade ?? null) as string | null;
        const neighborhood = (row?.localidade ?? row?.bairro ?? null) as string | null;

        const list = devsByBroker.get(brokerId) ?? [];
        list.push({
          id: String(row?.id ?? crypto.randomUUID()),
          name,
          status: (row?.status ?? null) as string | null,
          units_count: safeUnits,
          total_area_m2: safeArea,
          neighborhood,
          city,
        });
        devsByBroker.set(brokerId, list);
      }
    }

    const view: BrokerRowView[] = brokerRows.map((b) => {
      const name = (b.full_name ?? "").trim() || "-";
      const email = (b.email ?? "").trim() || "-";
      const whatsapp = (b.whatsapp ?? "").trim() || "-";
      const creci = (b.creci ?? "").trim() || "-";
      const status = statusBadge(b.status ?? null);
      const assignedProperties = propsByBroker.get(b.id) ?? [];
      const assignedDevelopments = devsByBroker.get(b.id) ?? [];
      const inHands = assignedProperties.length + assignedDevelopments.length;
      const clicks = whatsClicksByBroker.get(b.id) ?? 0;
      return {
        id: b.id,
        full_name: name,
        email,
        whatsapp,
        creci,
        statusLabel: status.label,
        isActive: status.active,
        propertiesInHands: inHands,
        assignedProperties,
        assignedDevelopments,
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

  async function createBroker() {
    setCreateError(null);

    if (!supabase) {
      setCreateError(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    const name = createName.trim();
    const email = createEmail.trim();
    const whatsappRaw = createWhatsapp.trim();
    const whatsapp = whatsappRaw.replace(/\D+/g, "");
    const creci = createCreci.trim();
    if (!name) {
      setCreateError("Nome é obrigatório.");
      return;
    }

    if (!whatsapp) {
      setCreateError("WhatsApp é obrigatório.");
      return;
    }

    if (!creci) {
      setCreateError("CRECI é obrigatório.");
      return;
    }

    setCreating(true);
    try {
      const payload: any = {
        id: crypto.randomUUID(),
        full_name: name,
        email: email || null,
        whatsapp,
        creci,
        role: "broker",
        status: "ativo",
      };

      const res = await (supabase as any).from("profiles").insert(payload);
      if (res?.error) {
        setCreateError(res.error.message);
        return;
      }

      setIsCreateOpen(false);
      setCreateName("");
      setCreateEmail("");
      setCreateWhatsapp("");
      setCreateCreci("");
      await loadBaseData();
    } catch {
      setCreateError("Não foi possível cadastrar o corretor agora.");
    } finally {
      setCreating(false);
    }

  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-3xl bg-white px-6 py-6 shadow-[0_25px_60px_-50px_rgba(15,23,42,0.55)] ring-1 ring-slate-200/70">
        <div>
          <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">GESTÃO DE CORRETORES</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Gerenciar Corretores</div>
          <div className="mt-1 text-sm text-slate-600">Cadastre, aprove e controle o time.</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#2b6cff] px-5 text-sm font-semibold text-white shadow-[0_10px_26px_-18px_rgba(43,108,255,0.85)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#255fe6] sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Novo Corretor
          </button>
          <button
            type="button"
            onClick={() => void loadBaseData()}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50 sm:w-auto"
          >
            Recarregar
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200/70">
          {errorMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-2xl bg-white px-6 py-6 text-sm text-slate-600 shadow-lg">
          Carregando...
        </div>
      ) : rows.length === 0 ? (
        <div className="flex w-full items-center justify-center py-10">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-10 shadow-xl">
            <div className="mx-auto flex max-w-md flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <UsersPlaceholderIcon className="h-8 w-8" />
              </div>
              <div className="mt-6 text-xl font-semibold tracking-tight text-slate-900">
                Pronto para começar?
              </div>
              <div className="mt-2 text-sm text-slate-600">
                Cadastre seu primeiro corretor e acompanhe a performance em tempo real.
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2b6cff] px-6 text-sm font-semibold text-white shadow-[0_10px_26px_-18px_rgba(43,108,255,0.85)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#255fe6] sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                Novo Corretor
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => {
            const showTags = r.assignedProperties.slice(0, 6);
            const hasClicks = r.whatsClicks > 0;
            const creciLabel = r.creci !== "-" ? `CRECI: ${r.creci}` : "CRECI: -";
            const statusInfo = approvalBadge(r.statusLabel);
            const canApprove = !r.isActive;
            const isUpdatingApproval = updatingApprovalId === r.id;

            const managedItems = (
                  [
                    ...r.assignedProperties.map((p) => ({
                      kind: "property" as const,
                      id: p.id,
                      title: p.title,
                      purpose: p.purpose,
                      neighborhood: p.neighborhood,
                      city: p.city,
                      area_m2: p.area_m2,
                      bedrooms: p.bedrooms,
                      parking_spots: p.parking_spots,
                      units_count: null as number | null,
                      status: null as string | null,
                    })),
                    ...r.assignedDevelopments.map((d) => ({
                      kind: "development" as const,
                      id: d.id,
                      title: d.name,
                      purpose: null as string | null,
                      neighborhood: d.neighborhood,
                      city: d.city,
                      area_m2: d.total_area_m2,
                      bedrooms: null as number | null,
                      parking_spots: null as number | null,
                      units_count: d.units_count,
                      status: d.status,
                    })),
                  ]
                ).slice(0, 6);

            const managedTotal = r.assignedProperties.length + r.assignedDevelopments.length;
            const hiddenCount = Math.max(0, managedTotal - managedItems.length);

            return (
              <div
                key={r.id}
                className="group relative rounded-2xl bg-white p-6 shadow-xl transition-all duration-300 hover:-translate-y-[2px]"
              >
                    <div className="flex items-start justify-between gap-4">
                      <div className="relative">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                          {initialsFromName(r.full_name)}
                        </div>
                        <div
                          className={
                            "absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full ring-2 ring-white " +
                            (r.isActive ? "bg-emerald-500" : "bg-slate-300")
                          }
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-base font-semibold text-slate-900">{r.full_name}</div>
                        <div className="mt-1 truncate text-xs font-semibold text-slate-500">{creciLabel}</div>
                        <div className="mt-2">
                          <span
                            className={
                              "inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-semibold ring-1 " +
                              statusInfo.cls
                            }
                          >
                            {statusInfo.label}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedBrokerId(r.id)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50"
                          aria-label="Ver relatório"
                          title="Ver relatório"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(r.id)}
                          disabled={deletingId === r.id}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label="Excluir corretor"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {canApprove ? (
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => void handleApprove(r.id)}
                          disabled={isUpdatingApproval}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {isUpdatingApproval ? "Aprovando..." : "Aprovar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void setBrokerApproval(r.id, "recusado")}
                          disabled={isUpdatingApproval}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <XCircle className="h-4 w-4" />
                          {isUpdatingApproval ? "Recusando..." : "Recusar"}
                        </button>
                      </div>
                    ) : null}

                    <div className="mt-5 flex items-center justify-between gap-4">
                      <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200/70">
                        <div className="text-2xl font-semibold tracking-tight text-slate-900">{r.propertiesInHands}</div>
                        <div className="text-xs font-semibold text-slate-600">itens</div>
                      </div>

                      <div
                        className={
                          "flex h-20 w-20 flex-col items-center justify-center rounded-full transition-all duration-300 " +
                          (hasClicks
                            ? "bg-[#22c55e] text-white shadow-[0_18px_34px_-22px_rgba(34,197,94,0.95)]"
                            : "bg-slate-100 text-slate-600 ring-1 ring-slate-200/70")
                        }
                        title={hasClicks ? `${r.whatsClicks} cliques` : "0 cliques"}
                      >
                        <WhatsappIcon className={"h-5 w-5 " + (hasClicks ? "text-white" : "text-slate-400")} />
                        <div className={"mt-1 text-lg font-semibold leading-none " + (hasClicks ? "text-white" : "text-slate-700")}>
                          {r.whatsClicks}
                        </div>
                        <div className={"mt-0.5 text-[10px] font-semibold " + (hasClicks ? "text-white/90" : "text-slate-400")}>
                          {hasClicks ? "cliques" : "0 cliques"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {r.isActive ? (
                          <div className="w-full rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
                            <div className="text-xs font-semibold tracking-wide text-slate-700">Imóveis sob Gestão</div>

                            {managedTotal === 0 ? (
                              <div className="mt-3 rounded-xl bg-white px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200/70">
                                Nenhum imóvel vinculado.
                              </div>
                            ) : (
                              <div className="mt-3 space-y-2">
                                {managedItems.map((p) => {
                                  const addr = [p.neighborhood, p.city].filter(Boolean).join(" / ") || "-";
                                  return (
                                    <div
                                      key={p.id}
                                      className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200/70"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <div className="truncate text-sm font-semibold text-slate-900" title={p.title}>
                                            {p.title}
                                          </div>
                                          <div className="mt-1 truncate text-xs font-semibold text-slate-500" title={addr}>
                                            {addr}
                                          </div>
                                        </div>
                                        {p.kind === "property" ? (
                                          <span
                                            className={
                                              "shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ring-1 " +
                                              purposeBadgeCls(p.purpose)
                                            }
                                          >
                                            {purposeLabel(p.purpose)}
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200/70">
                                            <Building2 className="h-3.5 w-3.5" />
                                            {p.status ? String(p.status) : "Empreendimento"}
                                          </span>
                                        )}
                                      </div>

                                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-slate-600">
                                        <div className="inline-flex items-center gap-1.5">
                                          <Ruler className="h-3.5 w-3.5 text-slate-400" />
                                          <span>{p.area_m2 != null && Number.isFinite(p.area_m2) ? `${p.area_m2} m²` : "-"}</span>
                                        </div>
                                        {p.kind === "property" ? (
                                          <>
                                            <div className="inline-flex items-center gap-1.5">
                                              <BedDouble className="h-3.5 w-3.5 text-slate-400" />
                                              <span>{p.bedrooms != null && Number.isFinite(p.bedrooms) ? `${p.bedrooms}` : "-"}</span>
                                            </div>
                                            <div className="inline-flex items-center gap-1.5">
                                              <Car className="h-3.5 w-3.5 text-slate-400" />
                                              <span>
                                                {p.parking_spots != null && Number.isFinite(p.parking_spots)
                                                  ? `${p.parking_spots}`
                                                  : "-"}
                                              </span>
                                            </div>
                                          </>
                                        ) : (
                                          <div className="inline-flex items-center gap-1.5">
                                            <span className="text-slate-500">Unidades:</span>
                                            <span>
                                              {p.units_count != null && Number.isFinite(p.units_count) ? `${p.units_count}` : "-"}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                                {hiddenCount > 0 ? (
                                  <div className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-600 ring-1 ring-slate-200/70">
                                    +{hiddenCount} itens
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </div>
                        ) : showTags.length > 0 ? (
                          showTags.map((p) => (
                            <div
                              key={p.id}
                              className="inline-flex max-w-full items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200/70"
                              title={p.title}
                            >
                              <span className={"h-2 w-2 rounded-full " + (normalizePurpose(p.purpose) === "locacao" ? "bg-emerald-500" : "bg-blue-600")} />
                              <span className="max-w-[220px] truncate">{p.title}</span>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200/70">
                            Nenhum imóvel atribuído.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
            );
          })}
        </div>
      )}

        {selectedBroker ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
            <button
              type="button"
              onClick={() => setSelectedBrokerId(null)}
              className="absolute inset-0 bg-slate-900/40"
              aria-label="Fechar"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="broker-report-title"
              className="relative w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200/70"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">RELATÓRIO</div>
                  <div id="broker-report-title" className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                    {selectedBroker.full_name}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">{selectedBroker.email}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedBrokerId(null)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-700 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200/70">
                  <div className="text-[11px] font-semibold tracking-wide text-slate-600">Imóveis em mãos</div>
                  <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                    {selectedBroker.propertiesInHands}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200/70">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-semibold tracking-wide text-slate-600">Cliques WhatsApp</div>
                    <WhatsappIcon className={"h-4 w-4 " + (selectedBroker.whatsClicks > 0 ? "text-emerald-600" : "text-slate-400")} />
                  </div>
                  <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                    {selectedBroker.whatsClicks} {selectedBroker.whatsClicks === 1 ? "clique" : "cliques"}
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <div className="text-xs font-semibold tracking-wide text-slate-600">Imóveis</div>
                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {selectedBroker.assignedProperties.length > 0 ? (
                    selectedBroker.assignedProperties.slice(0, 24).map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200/70"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">{p.title}</div>
                          <div className="mt-1 inline-flex items-center gap-2">
                            <span
                              className={
                                "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ring-1 " +
                                purposeBadgeCls(p.purpose)
                              }
                            >
                              {purposeLabel(p.purpose)}
                            </span>
                            <div className="text-xs text-slate-500">
                              {p.data_direcionamento
                                ? new Date(p.data_direcionamento).toLocaleDateString("pt-BR")
                                : "Aguardando registro"}
                            </div>
                          </div>
                        </div>

                        {p.clicks > 0 ? (
                          <div className="shrink-0 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/70">
                            <MessageCircle className="h-3.5 w-3.5" />
                            {p.clicks}
                          </div>
                        ) : (
                          <div className="shrink-0 text-xs font-semibold text-slate-400">0</div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl bg-slate-50 px-5 py-5 text-sm text-slate-600 ring-1 ring-slate-200/70">
                      Nenhum imóvel atribuído.
                    </div>
                  )}
                </div>
                {selectedBroker.assignedProperties.length > 24 ? (
                  <div className="mt-3 text-xs font-semibold text-slate-500">
                    +{selectedBroker.assignedProperties.length - 24} imóveis não exibidos
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {isCreateOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
            <button
              type="button"
              onClick={() => {
                if (creating) return;
                setIsCreateOpen(false);
                setCreateError(null);
                setCreateName("");
                setCreateEmail("");
                setCreateWhatsapp("");
                setCreateCreci("");
              }}
              className="absolute inset-0 bg-slate-900/40"
              aria-label="Fechar"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-broker-title"
              className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200/70"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">NOVO CORRETOR</div>
                  <div id="create-broker-title" className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                    Cadastro rápido
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (creating) return;
                    setIsCreateOpen(false);
                    setCreateError(null);
                    setCreateName("");
                    setCreateEmail("");
                    setCreateWhatsapp("");
                    setCreateCreci("");
                  }}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-700 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {createError ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {createError}
                </div>
              ) : null}

              <div className="mt-5 grid gap-4">
                <div>
                  <div className="text-xs font-semibold text-slate-600">Nome</div>
                  <input
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    className="mt-2 h-12 w-full rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#2b6cff]/40"
                    placeholder="Nome do corretor"
                  />
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-600">WhatsApp</div>
                  <input
                    value={createWhatsapp}
                    onChange={(e) => setCreateWhatsapp(e.target.value.replace(/\D+/g, ""))}
                    inputMode="numeric"
                    className="mt-2 h-12 w-full rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#2b6cff]/40"
                    placeholder="Ex: 94991234567"
                  />
                  <div className="mt-2 text-[11px] font-semibold text-slate-500">Use apenas números (DDD + número).</div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-600">CRECI</div>
                  <input
                    value={createCreci}
                    onChange={(e) => setCreateCreci(e.target.value)}
                    className="mt-2 h-12 w-full rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#2b6cff]/40"
                    placeholder="Ex: 12345-F"
                  />
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-600">Email (opcional)</div>
                  <input
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    className="mt-2 h-12 w-full rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#2b6cff]/40"
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (creating) return;
                    setIsCreateOpen(false);
                    setCreateError(null);
                    setCreateName("");
                    setCreateEmail("");
                    setCreateWhatsapp("");
                    setCreateCreci("");
                  }}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={creating}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void createBroker()}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-[#2b6cff] px-5 text-sm font-semibold text-white shadow-[0_10px_26px_-18px_rgba(43,108,255,0.85)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#255fe6] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={creating}
                >
                  {creating ? "Salvando..." : "Cadastrar"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
    </div>
  );
}

function UsersPlaceholderIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M16 11c1.66 0 3-1.57 3-3.5S17.66 4 16 4s-3 1.57-3 3.5S14.34 11 16 11Zm-8 0c1.66 0 3-1.57 3-3.5S9.66 4 8 4 5 5.57 5 7.5 6.34 11 8 11Zm0 2c-2.67 0-8 1.34-8 4v1h10.5v-1c0-1.52.83-2.84 2.07-3.82C11.39 13.09 9.35 13 8 13Zm8 0c-.32 0-.68.02-1.06.05 1.16.84 1.96 2 1.96 3.45v1H24v-1c0-2.66-5.33-4-8-4Z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  );
}
