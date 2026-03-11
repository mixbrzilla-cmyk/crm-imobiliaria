"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  BadgeCheck,
  Boxes,
  Calendar,
  ClipboardList,
  Gauge,
  HardHat,
  Minus,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react";

import { getSupabaseClient } from "@/lib/supabaseClient";
import { formatBRLInput, formatCurrencyBRL, parseBRLInputToNumber } from "@/lib/brl";

type MaterialStatus = "cotado" | "comprado" | "entregue";

type ObraMaterialRow = {
  id: string;
  name: string;
  vendor: string | null;
  status: MaterialStatus;
  unit_price: number | null;
  quantity: number | null;
  unit?: string | null;
  created_at?: string;
};

type WorkerRole = "pedreiro" | "reformador" | "pintor" | "outro";

type ObraWorkerRow = {
  id: string;
  full_name: string;
  role: WorkerRole;
  daily_rate: number | null;
  hourly_rate: number | null;
  active: boolean;
  created_at?: string;
};

type EntryType = "hora_homem" | "diaria" | "falta";

type ObraWorkerEntryRow = {
  id: string;
  worker_id: string;
  entry_date: string;
  entry_type: EntryType;
  hours: number | null;
  notes: string | null;
  created_at?: string;
};

type MaterialsForm = {
  name: string;
  vendor: string;
  status: MaterialStatus;
  unit_price: string;
  quantity: string;
  unit: "un" | "m2" | "l";
};

type WorkerForm = {
  full_name: string;
  role: WorkerRole;
  daily_rate: string;
  hourly_rate: string;
};

type EntryForm = {
  worker_id: string;
  entry_date: string;
  sector: "fundacao" | "alvenaria" | "eletrica";
  entry_type: EntryType;
  hours: string;
  notes: string;
};

function parseNumber(input: string) {
  const normalized = input.replace(/[^0-9.,-]/g, "").replace(",", ".").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function materialStatusCls(status: MaterialStatus) {
  if (status === "cotado") return "bg-slate-100 text-slate-700 ring-slate-200/70";
  if (status === "comprado") return "bg-sky-50 text-sky-700 ring-sky-200/70";
  return "bg-emerald-50 text-emerald-700 ring-emerald-200/70";
}

function entryTypeLabel(t: EntryType) {
  if (t === "hora_homem") return "Hora-Homem";
  if (t === "diaria") return "Diária";
  return "Falta";
}

function statusLabel(status: MaterialStatus) {
  if (status === "cotado") return "Cotado";
  if (status === "comprado") return "Comprado";
  return "Entregue";
}

function sectorLabel(sector: EntryForm["sector"]) {
  if (sector === "fundacao") return "Fundação";
  if (sector === "alvenaria") return "Alvenaria";
  return "Elétrica";
}

function sectorCls(sector: EntryForm["sector"]) {
  if (sector === "fundacao") return "bg-sky-50 text-sky-800 ring-sky-200/70";
  if (sector === "alvenaria") return "bg-amber-50 text-amber-900 ring-amber-200/70";
  return "bg-violet-50 text-violet-800 ring-violet-200/70";
}

export default function ObrasAdminPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [tab, setTab] = useState<"materiais" | "medicao">("materiais");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);

  const [materials, setMaterials] = useState<ObraMaterialRow[]>([]);
  const [isMaterialsLoading, setIsMaterialsLoading] = useState(false);
  const [isMaterialSaving, setIsMaterialSaving] = useState(false);
  const [materialsForm, setMaterialsForm] = useState<MaterialsForm>({
    name: "",
    vendor: "",
    status: "cotado",
    unit_price: "",
    quantity: "",
    unit: "un",
  });

  const [workers, setWorkers] = useState<ObraWorkerRow[]>([]);
  const [entries, setEntries] = useState<ObraWorkerEntryRow[]>([]);
  const [isWorkersLoading, setIsWorkersLoading] = useState(false);
  const [isWorkerSaving, setIsWorkerSaving] = useState(false);
  const [isEntrySaving, setIsEntrySaving] = useState(false);

  const [workerForm, setWorkerForm] = useState<WorkerForm>({
    full_name: "",
    role: "pedreiro",
    daily_rate: "",
    hourly_rate: "",
  });

  const [entryForm, setEntryForm] = useState<EntryForm>(() => {
    const today = new Date();
    const yyyy = String(today.getFullYear());
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return {
      worker_id: "",
      entry_date: `${yyyy}-${mm}-${dd}`,
      sector: "fundacao",
      entry_type: "diaria",
      hours: "",
      notes: "",
    };
  });

  const loadMaterials = useCallback(async () => {
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      setMaterials([]);
      return;
    }

    setIsMaterialsLoading(true);

    try {
      let res = await (supabase as any)
        .from("obra_materials")
        .select("id, name, vendor, status, unit_price, quantity, unit, created_at")
        .order("created_at", { ascending: false });

      if (res.error) {
        const msg = String((res.error as any)?.message ?? "");
        const isColumnNotFound = /column\s+\"?unit\"?\s+does\s+not\s+exist|column\s+unit\s+not\s+found/i.test(msg);
        const code = (res.error as any)?.code;
        const isSchemaMismatch = code === "PGRST204" || code === "PGRST301";
        if (isColumnNotFound || isSchemaMismatch) {
          res = await (supabase as any)
            .from("obra_materials")
            .select("id, name, vendor, status, unit_price, quantity, created_at")
            .order("created_at", { ascending: false });
        }
      }

      if (res.error) {
        setErrorMessage(res.error.message);
        setMaterials([]);
      } else {
        setMaterials((res.data ?? []) as ObraMaterialRow[]);
      }
    } catch {
      setErrorMessage("Não foi possível carregar os materiais agora.");
      setMaterials([]);
    } finally {
      setIsMaterialsLoading(false);
    }
  }, [supabase]);

  const loadWorkersAndEntries = useCallback(async () => {
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      setWorkers([]);
      setEntries([]);
      return;
    }

    setIsWorkersLoading(true);

    try {
      const [workersRes, entriesRes] = await Promise.allSettled([
        (supabase as any)
          .from("obra_workers")
          .select("id, full_name, role, daily_rate, hourly_rate, active, created_at")
          .order("full_name", { ascending: true }),
        (supabase as any)
          .from("obra_worker_entries")
          .select("id, worker_id, entry_date, entry_type, hours, notes, created_at")
          .order("entry_date", { ascending: false })
          .limit(120),
      ]);

      if (workersRes.status === "fulfilled") {
        if (workersRes.value.error) {
          setErrorMessage(workersRes.value.error.message);
          setWorkers([]);
        } else {
          const data = (workersRes.value.data ?? []) as ObraWorkerRow[];
          setWorkers(data);
          if (!entryForm.worker_id && data.length > 0) {
            setEntryForm((s) => ({ ...s, worker_id: data[0]!.id }));
          }
        }
      }

      if (entriesRes.status === "fulfilled") {
        if (entriesRes.value.error) {
          setErrorMessage(entriesRes.value.error.message);
          setEntries([]);
        } else {
          setEntries((entriesRes.value.data ?? []) as ObraWorkerEntryRow[]);
        }
      }
    } catch {
      setErrorMessage("Não foi possível carregar a medição agora.");
      setWorkers([]);
      setEntries([]);
    } finally {
      setIsWorkersLoading(false);
    }
  }, [entryForm.worker_id, supabase]);

  useEffect(() => {
    void loadMaterials();
  }, [loadMaterials]);

  useEffect(() => {
    if (tab !== "medicao") return;
    void loadWorkersAndEntries();
  }, [loadWorkersAndEntries, tab]);

  async function addMaterial(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    const unit = parseBRLInputToNumber(materialsForm.unit_price);
    const qty = parseNumber(materialsForm.quantity);

    setIsMaterialSaving(true);

    try {
      const payloadBase = {
        id: crypto.randomUUID(),
        name: materialsForm.name.trim(),
        vendor: materialsForm.vendor.trim() || null,
        status: materialsForm.status,
        unit_price: unit,
        quantity: qty,
      };

      const payloadAttempts: Array<any> = [
        { ...payloadBase, unit: materialsForm.unit },
        payloadBase,
      ];

      let lastError: any = null;
      for (const payload of payloadAttempts) {
        const { error } = await (supabase as any).from("obra_materials").insert(payload);
        if (!error) {
          lastError = null;
          break;
        }
        lastError = error;
        const msg = String((error as any)?.message ?? "");
        const isColumnNotFound = /column\s+\"?unit\"?\s+does\s+not\s+exist|column\s+unit\s+not\s+found/i.test(msg);
        const code = (error as any)?.code;
        const isSchemaMismatch = code === "PGRST204" || code === "PGRST301";
        if (!isColumnNotFound && !isSchemaMismatch) break;
      }

      if (lastError) {
        setErrorMessage(lastError.message);
        return;
      }

      setMaterialsForm({
        name: "",
        vendor: "",
        status: "cotado",
        unit_price: "",
        quantity: "",
        unit: "un",
      });

      await loadMaterials();
    } catch {
      setErrorMessage("Não foi possível salvar o material.");
    } finally {
      setIsMaterialSaving(false);
    }
  }

  function unitLabel(unit: string | null | undefined) {
    const u = String(unit ?? "").toLowerCase();
    if (u === "m2") return "m²";
    if (u === "l") return "L";
    return "un";
  }

  function unitOptionLabel(unit: MaterialsForm["unit"]) {
    if (unit === "m2") return "m²";
    if (unit === "l") return "Litros";
    return "Unidades";
  }

  async function updateMaterialStatus(id: string, status: MaterialStatus) {
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    setMaterials((current) => current.map((m) => (m.id === id ? { ...m, status } : m)));

    try {
      const { error } = await (supabase as any)
        .from("obra_materials")
        .update({ status })
        .eq("id", id);

      if (error) {
        setErrorMessage(error.message);
        await loadMaterials();
      }
    } catch {
      setErrorMessage("Não foi possível atualizar o status.");
      await loadMaterials();
    }
  }

  async function addWorker(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    const daily = parseBRLInputToNumber(workerForm.daily_rate);
    const hourly = parseBRLInputToNumber(workerForm.hourly_rate);

    setIsWorkerSaving(true);

    try {
      const payload = {
        id: crypto.randomUUID(),
        full_name: workerForm.full_name.trim(),
        role: workerForm.role,
        daily_rate: daily,
        hourly_rate: hourly,
        active: true,
      };

      const { error } = await (supabase as any).from("obra_workers").insert(payload);
      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setWorkerForm({ full_name: "", role: "pedreiro", daily_rate: "", hourly_rate: "" });
      await loadWorkersAndEntries();
    } catch {
      setErrorMessage("Não foi possível salvar o colaborador.");
    } finally {
      setIsWorkerSaving(false);
    }
  }

  async function addEntry(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    const hrs = entryForm.entry_type === "hora_homem" ? parseNumber(entryForm.hours) : null;

    setIsEntrySaving(true);

    try {
      const payload = {
        id: crypto.randomUUID(),
        worker_id: entryForm.worker_id,
        entry_date: entryForm.entry_date,
        entry_type: entryForm.entry_type,
        hours: hrs,
        notes: entryForm.notes.trim() || null,
      };

      const { error } = await (supabase as any).from("obra_worker_entries").insert(payload);
      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setEntryForm((s) => ({ ...s, hours: "", notes: "" }));
      await loadWorkersAndEntries();
    } catch {
      setErrorMessage("Não foi possível salvar o lançamento.");
    } finally {
      setIsEntrySaving(false);
    }
  }

  const totalMaterials = useMemo(() => {
    return materials.reduce((acc, m) => {
      const unit = m.unit_price ?? 0;
      const qty = m.quantity ?? 0;
      return acc + unit * qty;
    }, 0);
  }, [materials]);

  const pendingDeliveries = useMemo(() => {
    return materials.filter((m) => m.status !== "entregue").length;
  }, [materials]);

  const globalProgress = useMemo(() => {
    const total = Math.max(1, materials.length);
    const delivered = materials.filter((m) => m.status === "entregue").length;
    const pct = Math.round((delivered / total) * 100);
    return { pct, delivered, total };
  }, [materials]);

  const sectorProgress = useMemo(() => {
    const counts: Record<EntryForm["sector"], number> = {
      fundacao: 0,
      alvenaria: 0,
      eletrica: 0,
    };

    for (const e of entries) {
      const notes = String(e.notes ?? "").toLowerCase();
      if (notes.includes("[fundação]") || notes.includes("[fundacao]")) counts.fundacao += 1;
      else if (notes.includes("[alvenaria]")) counts.alvenaria += 1;
      else if (notes.includes("[elétrica]") || notes.includes("[eletrica]")) counts.eletrica += 1;
    }

    const max = Math.max(1, counts.fundacao, counts.alvenaria, counts.eletrica);
    const pct = (n: number) => Math.max(10, Math.round((n / max) * 100));
    return {
      counts,
      widths: {
        fundacao: pct(counts.fundacao),
        alvenaria: pct(counts.alvenaria),
        eletrica: pct(counts.eletrica),
      },
    };
  }, [entries]);

  const workerById = useMemo(() => {
    const map = new Map<string, ObraWorkerRow>();
    for (const w of workers) map.set(w.id, w);
    return map;
  }, [workers]);

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">GASTOS DA IMOBILIÁRIA</div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Controle de Gastos</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          Materiais, medição de equipe e pendências. Operação leve, sem Auth, com render estável.
        </p>
      </header>

      {errorMessage ? (
        <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200/70">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/40 p-6 shadow-md ring-1 ring-slate-200/70">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-700">Gastos</div>
            <ClipboardList className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {formatCurrencyBRL(totalMaterials)}
          </div>
          <div className="mt-2 text-xs text-slate-500">Materiais (unitário x quantidade)</div>
        </div>

        <div className="rounded-2xl bg-amber-50/70 p-6 shadow-md ring-1 ring-amber-200/70">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-amber-900">Pendências</div>
            <Boxes className="h-4 w-4 text-amber-700/70" />
          </div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{pendingDeliveries}</div>
          <div className="mt-2 text-xs text-amber-900/70">Itens ainda não entregues</div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-200/70">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-700">Equipe Ativa</div>
            <Users className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {workers.filter((w) => w.active).length}
          </div>
          <div className="mt-2 text-xs text-slate-500">Cadastros em obra</div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-200/70">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-700">Status Global da Obra</div>
            <Gauge className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div className="text-3xl font-semibold tracking-tight text-slate-900">{globalProgress.pct}%</div>
            <div className="text-xs font-semibold text-slate-500">
              {globalProgress.delivered}/{globalProgress.total} entregues
            </div>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-slate-100 ring-1 ring-slate-200/70">
            <div
              className="h-2 rounded-full bg-slate-900/70"
              style={{ width: `${Math.max(6, Math.min(100, globalProgress.pct))}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-slate-500">Baseado na entrega dos insumos</div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-3 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200/70">
          <button
            type="button"
            onClick={() => setTab("materiais")}
            className={
              "flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-300 " +
              (tab === "materiais"
                ? "bg-white text-slate-900 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70"
                : "text-slate-600 hover:bg-white/70")
            }
          >
            <Boxes className="h-4 w-4" />
            Materiais
          </button>
          <button
            type="button"
            onClick={() => setTab("medicao")}
            className={
              "flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-300 " +
              (tab === "medicao"
                ? "bg-white text-slate-900 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70"
                : "text-slate-600 hover:bg-white/70")
            }
          >
            <Users className="h-4 w-4" />
            Medição
          </button>
        </div>
      </section>

      {tab === "materiais" ? (
        <section className="w-full">
          <div className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-200/70">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Insumos</div>
                <div className="mt-1 text-xs text-slate-500">Tabela de compras, entregas e custos.</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-slate-500">
                  {isMaterialsLoading ? "Atualizando..." : `${materials.length} itens`}
                </div>
                <button
                  type="button"
                  onClick={() => void loadMaterials()}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  Atualizar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setIsMaterialModalOpen(true);
                  }}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#ff0000] px-4 text-xs font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#e60000]"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar Insumo
                </button>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200/70">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">Insumo</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">Status</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold tracking-wide text-slate-700">Unit.</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold tracking-wide text-slate-700">Qtd.</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold tracking-wide text-slate-700">Total</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold tracking-wide text-slate-700">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.length > 0 ? (
                    materials.map((m, idx) => {
                      const unit = m.unit_price ?? 0;
                      const qty = m.quantity ?? 0;
                      const total = unit * qty;
                      return (
                        <tr
                          key={m.id}
                          className={
                            "border-t border-slate-100 " + (idx % 2 === 1 ? "bg-slate-50/50" : "bg-white")
                          }
                        >
                          <td className="px-5 py-4">
                            <div className="text-sm font-semibold text-slate-900">{m.name}</div>
                            <div className="mt-1 text-xs text-slate-500">{m.vendor ?? "-"}</div>
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={
                                "inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ring-1 " +
                                materialStatusCls(m.status)
                              }
                            >
                              {statusLabel(m.status)}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right text-sm text-slate-700">{formatCurrencyBRL(unit)}</td>
                          <td className="px-5 py-4 text-right text-sm text-slate-700">
                            {m.quantity != null ? `${qty} ${unitLabel(m.unit ?? null)}` : "-"}
                          </td>
                          <td className="px-5 py-4 text-right text-sm font-semibold text-slate-900">{formatCurrencyBRL(total)}</td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => void updateMaterialStatus(m.id, "cotado")}
                                className="inline-flex h-9 items-center justify-center rounded-xl bg-white px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50"
                              >
                                Cotado
                              </button>
                              <button
                                type="button"
                                onClick={() => void updateMaterialStatus(m.id, "comprado")}
                                className="inline-flex h-9 items-center justify-center rounded-xl bg-[#001f3f] px-3 text-xs font-semibold text-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.20)] transition-all duration-300 hover:bg-[#001a33]"
                              >
                                Comprado
                              </button>
                              <button
                                type="button"
                                onClick={() => void updateMaterialStatus(m.id, "entregue")}
                                className="inline-flex h-9 items-center justify-center rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.20)] transition-all duration-300 hover:bg-emerald-700"
                              >
                                Entregue
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="px-5 py-8 text-sm text-slate-600" colSpan={6}>
                        Nenhum insumo cadastrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : (
        <section className="w-full">
          <div className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-200/70">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Modo Medição</div>
                <div className="mt-1 text-xs text-slate-500">
                  Setores + lançamentos recentes. Dica: o setor fica registrado no texto como [Fundação], [Alvenaria], [Elétrica].
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-slate-500">
                  {isWorkersLoading ? "Atualizando..." : `${entries.length} lançamentos`}
                </div>
                <button
                  type="button"
                  onClick={() => void loadWorkersAndEntries()}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  Atualizar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setIsWorkerModalOpen(true);
                  }}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50"
                >
                  <HardHat className="h-4 w-4" />
                  Adicionar Colaborador
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setIsEntryModalOpen(true);
                  }}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#001f3f] px-4 text-xs font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#001a33]"
                >
                  <Plus className="h-4 w-4" />
                  Lançar Medição
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
              {(
                [
                  { key: "fundacao" as const, icon: <ClipboardList className="h-4 w-4" /> },
                  { key: "alvenaria" as const, icon: <Boxes className="h-4 w-4" /> },
                  { key: "eletrica" as const, icon: <Gauge className="h-4 w-4" /> },
                ] as const
              ).map((s) => (
                <div key={s.key} className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200/70">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">{sectorLabel(s.key)}</div>
                    <div className="text-slate-400">{s.icon}</div>
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <span
                      className={
                        "inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ring-1 " +
                        sectorCls(s.key)
                      }
                    >
                      {sectorProgress.counts[s.key]} lanç.
                    </span>
                    <div className="text-xs font-semibold text-slate-500">Evolução</div>
                  </div>
                  <div className="mt-3 h-2 w-full rounded-full bg-white ring-1 ring-slate-200/70">
                    <div
                      className="h-2 rounded-full bg-slate-900/70"
                      style={{ width: `${sectorProgress.widths[s.key]}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200/70">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">Colaborador</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">Data</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">Tipo</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold tracking-wide text-slate-700">Horas</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">Observações</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.length > 0 ? (
                    entries.map((e, idx) => {
                      const worker = workerById.get(e.worker_id);
                      return (
                        <tr
                          key={e.id}
                          className={
                            "border-t border-slate-100 " + (idx % 2 === 1 ? "bg-slate-50/50" : "bg-white")
                          }
                        >
                          <td className="px-5 py-4">
                            <div className="text-sm font-semibold text-slate-900">{worker?.full_name ?? "-"}</div>
                            <div className="mt-1 text-xs text-slate-500">{worker?.role ?? "-"}</div>
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-700">{e.entry_date}</td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70">
                              {entryTypeLabel(e.entry_type)}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right text-sm text-slate-700">{e.hours ?? "-"}</td>
                          <td className="px-5 py-4 text-sm text-slate-700">{e.notes ?? "-"}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="px-5 py-8 text-sm text-slate-600" colSpan={5}>
                        Nenhuma medição lançada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 rounded-2xl bg-slate-50 px-5 py-4 text-sm text-slate-700 ring-1 ring-slate-200/70">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-slate-500" />
                <span className="font-semibold text-slate-900">Regra:</span> Hora-homem salva as horas. Diária e Falta salvam sem horas.
              </div>
            </div>
          </div>
        </section>
      )}

      {isMaterialModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_-24px_rgba(15,23,42,0.65)] ring-1 ring-slate-200/70">
            <div className="flex items-start justify-between gap-6 border-b border-slate-100 px-6 py-5">
              <div>
                <div className="text-sm font-semibold text-slate-900">Adicionar Insumo</div>
                <div className="mt-1 text-xs text-slate-500">Cadastro rápido com total automático.</div>
              </div>
              <button
                type="button"
                onClick={() => setIsMaterialModalOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>

            <form
              onSubmit={(e) => {
                void addMaterial(e);
                setIsMaterialModalOpen(false);
              }}
              className="px-6 py-6"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Insumo</span>
                  <input
                    value={materialsForm.name}
                    onChange={(e) => setMaterialsForm((s) => ({ ...s, name: e.target.value }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                    placeholder="Ex: Cimento, Porcelanato..."
                    required
                  />
                </label>

                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Fornecedor (opcional)</span>
                  <input
                    value={materialsForm.vendor}
                    onChange={(e) => setMaterialsForm((s) => ({ ...s, vendor: e.target.value }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                    placeholder="Ex: Leroy / Depósito"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Valor Unitário</span>
                  <input
                    value={materialsForm.unit_price}
                    onChange={(e) => setMaterialsForm((s) => ({ ...s, unit_price: formatBRLInput(e.target.value) }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                    placeholder="R$ 0,00"
                    inputMode="decimal"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Quantidade</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={materialsForm.quantity}
                      onChange={(e) => setMaterialsForm((s) => ({ ...s, quantity: e.target.value }))}
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                      placeholder="1"
                    />
                    <select
                      value={materialsForm.unit}
                      onChange={(e) => setMaterialsForm((s) => ({ ...s, unit: e.target.value as MaterialsForm["unit"] }))}
                      className="h-11 rounded-xl bg-white px-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                      title="Unidade"
                      aria-label="Unidade"
                    >
                      <option value="un">{unitOptionLabel("un")}</option>
                      <option value="m2">{unitOptionLabel("m2")}</option>
                      <option value="l">{unitOptionLabel("l")}</option>
                    </select>
                  </div>
                </label>

                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Status</span>
                  <select
                    value={materialsForm.status}
                    onChange={(e) => setMaterialsForm((s) => ({ ...s, status: e.target.value as MaterialStatus }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                  >
                    <option value="cotado">Cotado</option>
                    <option value="comprado">Comprado</option>
                    <option value="entregue">Entregue</option>
                  </select>
                </label>
              </div>

              <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200/70">
                <span className="font-semibold text-slate-900">Total:</span>{" "}
                {(() => {
                  const unit = parseBRLInputToNumber(materialsForm.unit_price) ?? 0;
                  const qty = parseNumber(materialsForm.quantity) ?? 0;
                  return formatCurrencyBRL(unit * qty);
                })()}
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="submit"
                  disabled={isMaterialSaving}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#ff0000] px-6 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:bg-[#e60000] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <BadgeCheck className="h-4 w-4" />
                  {isMaterialSaving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isWorkerModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_-24px_rgba(15,23,42,0.65)] ring-1 ring-slate-200/70">
            <div className="flex items-start justify-between gap-6 border-b border-slate-100 px-6 py-5">
              <div>
                <div className="text-sm font-semibold text-slate-900">Adicionar Colaborador</div>
                <div className="mt-1 text-xs text-slate-500">Cadastro de pedreiros/reformadores.</div>
              </div>
              <button
                type="button"
                onClick={() => setIsWorkerModalOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>

            <form
              onSubmit={(e) => {
                void addWorker(e);
                setIsWorkerModalOpen(false);
              }}
              className="px-6 py-6"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Nome</span>
                  <input
                    value={workerForm.full_name}
                    onChange={(e) => setWorkerForm((s) => ({ ...s, full_name: e.target.value }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                    placeholder="Ex: João da Silva"
                    required
                  />
                </label>

                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Função</span>
                  <select
                    value={workerForm.role}
                    onChange={(e) => setWorkerForm((s) => ({ ...s, role: e.target.value as WorkerRole }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                  >
                    <option value="pedreiro">Pedreiro</option>
                    <option value="reformador">Reformador</option>
                    <option value="pintor">Pintor</option>
                    <option value="outro">Outro</option>
                  </select>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Diária</span>
                  <input
                    value={workerForm.daily_rate}
                    onChange={(e) => setWorkerForm((s) => ({ ...s, daily_rate: formatBRLInput(e.target.value) }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                    placeholder="R$ 0,00"
                    inputMode="decimal"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Hora</span>
                  <input
                    value={workerForm.hourly_rate}
                    onChange={(e) => setWorkerForm((s) => ({ ...s, hourly_rate: formatBRLInput(e.target.value) }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                    placeholder="R$ 0,00"
                    inputMode="decimal"
                  />
                </label>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="submit"
                  disabled={isWorkerSaving}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#ff0000] px-6 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:bg-[#e60000] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <BadgeCheck className="h-4 w-4" />
                  {isWorkerSaving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isEntryModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_-24px_rgba(15,23,42,0.65)] ring-1 ring-slate-200/70">
            <div className="flex items-start justify-between gap-6 border-b border-slate-100 px-6 py-5">
              <div>
                <div className="text-sm font-semibold text-slate-900">Lançar Medição</div>
                <div className="mt-1 text-xs text-slate-500">Hora-homem, diária ou falta.</div>
              </div>
              <button
                type="button"
                onClick={() => setIsEntryModalOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const prefix = `[${sectorLabel(entryForm.sector)}] `;
                const nextNotes = String(entryForm.notes ?? "").trim();
                setEntryForm((s) => ({ ...s, notes: prefix + nextNotes }));
                void addEntry(e);
                setIsEntryModalOpen(false);
              }}
              className="px-6 py-6"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Setor</span>
                  <select
                    value={entryForm.sector}
                    onChange={(e) => setEntryForm((s) => ({ ...s, sector: e.target.value as EntryForm["sector"] }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                  >
                    <option value="fundacao">Fundação</option>
                    <option value="alvenaria">Alvenaria</option>
                    <option value="eletrica">Elétrica</option>
                  </select>
                </label>

                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Colaborador</span>
                  <select
                    value={entryForm.worker_id}
                    onChange={(e) => setEntryForm((s) => ({ ...s, worker_id: e.target.value }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                    required
                  >
                    {workers.length > 0 ? (
                      workers.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.full_name}
                        </option>
                      ))
                    ) : (
                      <option value="">Sem colaboradores</option>
                    )}
                  </select>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Data</span>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="date"
                      value={entryForm.entry_date}
                      onChange={(e) => setEntryForm((s) => ({ ...s, entry_date: e.target.value }))}
                      className="h-11 w-full rounded-xl bg-white pl-10 pr-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                      required
                    />
                  </div>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Tipo</span>
                  <select
                    value={entryForm.entry_type}
                    onChange={(e) =>
                      setEntryForm((s) => ({
                        ...s,
                        entry_type: e.target.value as EntryType,
                        hours: e.target.value === "hora_homem" ? s.hours : "",
                      }))
                    }
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                  >
                    <option value="hora_homem">Hora-Homem</option>
                    <option value="diaria">Diária</option>
                    <option value="falta">Falta</option>
                  </select>
                </label>

                {entryForm.entry_type === "hora_homem" ? (
                  <label className="flex flex-col gap-2 md:col-span-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Horas</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setEntryForm((s) => {
                            const current = parseNumber(s.hours) ?? 0;
                            return { ...s, hours: String(Math.max(0, current - 1)) };
                          })
                        }
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-700 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <input
                        value={entryForm.hours}
                        onChange={(e) => setEntryForm((s) => ({ ...s, hours: e.target.value }))}
                        className="h-11 flex-1 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                        placeholder="8"
                        required
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setEntryForm((s) => {
                            const current = parseNumber(s.hours) ?? 0;
                            return { ...s, hours: String(current + 1) };
                          })
                        }
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-700 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </label>
                ) : null}

                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Observações (opcional)</span>
                  <input
                    value={entryForm.notes}
                    onChange={(e) => setEntryForm((s) => ({ ...s, notes: e.target.value }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                    placeholder="Ex: 2 horas extras"
                  />
                </label>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="submit"
                  disabled={isEntrySaving || workers.length === 0}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#001f3f] px-6 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:bg-[#001a33] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <BadgeCheck className="h-4 w-4" />
                  {isEntrySaving ? "Salvando..." : "Registrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
