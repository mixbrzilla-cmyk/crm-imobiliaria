"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  BadgeCheck,
  Boxes,
  Calendar,
  ClipboardList,
  Minus,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react";

import { getSupabaseClient } from "@/lib/supabaseClient";

type MaterialStatus = "cotado" | "comprado" | "entregue";

type ObraMaterialRow = {
  id: string;
  name: string;
  vendor: string | null;
  status: MaterialStatus;
  unit_price: number | null;
  quantity: number | null;
  created_at?: string;
};

type WorkerRole = "pedreiro" | "reformador" | "outro";

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
  entry_type: EntryType;
  hours: string;
  notes: string;
};

function formatCurrencyBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });
}

function parseMoney(input: string) {
  const normalized = input.replace(/[^0-9.,-]/g, "").replace(",", ".").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

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

export default function ObrasAdminPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [tab, setTab] = useState<"materiais" | "medicao">("materiais");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [materials, setMaterials] = useState<ObraMaterialRow[]>([]);
  const [isMaterialsLoading, setIsMaterialsLoading] = useState(false);
  const [isMaterialSaving, setIsMaterialSaving] = useState(false);
  const [materialsForm, setMaterialsForm] = useState<MaterialsForm>({
    name: "",
    vendor: "",
    status: "cotado",
    unit_price: "",
    quantity: "",
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
      const res = await (supabase as any)
        .from("obra_materials")
        .select("id, name, vendor, status, unit_price, quantity, created_at")
        .order("created_at", { ascending: false });

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

    const unit = parseMoney(materialsForm.unit_price);
    const qty = parseNumber(materialsForm.quantity);

    setIsMaterialSaving(true);

    try {
      const payload = {
        id: crypto.randomUUID(),
        name: materialsForm.name.trim(),
        vendor: materialsForm.vendor.trim() || null,
        status: materialsForm.status,
        unit_price: unit,
        quantity: qty,
      };

      const { error } = await (supabase as any).from("obra_materials").insert(payload);
      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setMaterialsForm({
        name: "",
        vendor: "",
        status: "cotado",
        unit_price: "",
        quantity: "",
      });

      await loadMaterials();
    } catch {
      setErrorMessage("Não foi possível salvar o material.");
    } finally {
      setIsMaterialSaving(false);
    }
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

    const daily = parseMoney(workerForm.daily_rate);
    const hourly = parseMoney(workerForm.hourly_rate);

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

  const workerById = useMemo(() => {
    const map = new Map<string, ObraWorkerRow>();
    for (const w of workers) map.set(w.id, w);
    return map;
  }, [workers]);

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">OBRAS & ENGENHARIA</div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Controle de Obra</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          Materiais, medição de equipe e pendências. Operação leve, sem Auth, com render estável.
        </p>
      </header>

      {errorMessage ? (
        <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200/70">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
          <div className="text-sm font-medium text-slate-600">Gastos (Materiais)</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {formatCurrencyBRL(totalMaterials)}
          </div>
          <div className="mt-2 text-xs text-slate-500">Somatório: unitário x quantidade</div>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
          <div className="text-sm font-medium text-slate-600">Pendências (Entrega)</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {pendingDeliveries}
          </div>
          <div className="mt-2 text-xs text-slate-500">Itens ainda não entregues</div>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
          <div className="text-sm font-medium text-slate-600">Equipe Ativa</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {workers.filter((w) => w.active).length}
          </div>
          <div className="mt-2 text-xs text-slate-500">Cadastros em obra</div>
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
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Novo Insumo</div>
                  <div className="mt-1 text-xs text-slate-500">Cadastro rápido (com total automático).</div>
                </div>
                <button
                  type="button"
                  onClick={() => void loadMaterials()}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  Atualizar
                </button>
              </div>

              <form onSubmit={addMaterial} className="mt-5 flex flex-col gap-4">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Insumo</span>
                  <input
                    value={materialsForm.name}
                    onChange={(e) => setMaterialsForm((s) => ({ ...s, name: e.target.value }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                    placeholder="Ex: Cimento, Porcelanato..."
                    required
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Fornecedor (opcional)</span>
                  <input
                    value={materialsForm.vendor}
                    onChange={(e) => setMaterialsForm((s) => ({ ...s, vendor: e.target.value }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                    placeholder="Ex: Leroy / Depósito"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Valor Unitário</span>
                    <input
                      value={materialsForm.unit_price}
                      onChange={(e) => setMaterialsForm((s) => ({ ...s, unit_price: e.target.value }))}
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                      placeholder="0,00"
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Quantidade</span>
                    <input
                      value={materialsForm.quantity}
                      onChange={(e) => setMaterialsForm((s) => ({ ...s, quantity: e.target.value }))}
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                      placeholder="1"
                    />
                  </label>
                </div>

                <label className="flex flex-col gap-2">
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

                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200/70">
                  <span className="font-semibold text-slate-900">Total:</span>{" "}
                  {(() => {
                    const unit = parseMoney(materialsForm.unit_price) ?? 0;
                    const qty = parseNumber(materialsForm.quantity) ?? 0;
                    return formatCurrencyBRL(unit * qty);
                  })()}
                </div>

                <button
                  type="submit"
                  disabled={isMaterialSaving}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#ff0000] px-5 text-sm font-semibold text-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.20)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#e60000] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  {isMaterialSaving ? "Salvando..." : "Adicionar"}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Lista de Insumos</div>
                  <div className="mt-1 text-xs text-slate-500">Valor unitário x quantidade (total por item).</div>
                </div>
                <div className="text-xs text-slate-500">
                  {isMaterialsLoading ? "Atualizando..." : `${materials.length} itens`}
                </div>
              </div>

              <div className="mt-5 overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200/70">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">
                        Insumo
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">
                        Status
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold tracking-wide text-slate-700">
                        Unit.
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold tracking-wide text-slate-700">
                        Qtd.
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold tracking-wide text-slate-700">
                        Total
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold tracking-wide text-slate-700">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.length > 0 ? (
                      materials.map((m) => {
                        const unit = m.unit_price ?? 0;
                        const qty = m.quantity ?? 0;
                        const total = unit * qty;
                        return (
                          <tr key={m.id} className="border-t border-slate-100">
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
                                {m.status}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right text-sm text-slate-700">
                              {formatCurrencyBRL(unit)}
                            </td>
                            <td className="px-5 py-4 text-right text-sm text-slate-700">{qty}</td>
                            <td className="px-5 py-4 text-right text-sm font-semibold text-slate-900">
                              {formatCurrencyBRL(total)}
                            </td>
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
          </div>
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Equipe</div>
                  <div className="mt-1 text-xs text-slate-500">Cadastro de pedreiros/reformadores.</div>
                </div>
                <Users className="h-4 w-4 text-slate-400" />
              </div>

              <form onSubmit={addWorker} className="mt-5 flex flex-col gap-4">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Nome</span>
                  <input
                    value={workerForm.full_name}
                    onChange={(e) => setWorkerForm((s) => ({ ...s, full_name: e.target.value }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                    placeholder="Ex: João da Silva"
                    required
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Função</span>
                  <select
                    value={workerForm.role}
                    onChange={(e) => setWorkerForm((s) => ({ ...s, role: e.target.value as WorkerRole }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                  >
                    <option value="pedreiro">Pedreiro</option>
                    <option value="reformador">Reformador</option>
                    <option value="outro">Outro</option>
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Diária</span>
                    <input
                      value={workerForm.daily_rate}
                      onChange={(e) => setWorkerForm((s) => ({ ...s, daily_rate: e.target.value }))}
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                      placeholder="0,00"
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Hora</span>
                    <input
                      value={workerForm.hourly_rate}
                      onChange={(e) => setWorkerForm((s) => ({ ...s, hourly_rate: e.target.value }))}
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                      placeholder="0,00"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isWorkerSaving}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#ff0000] px-5 text-sm font-semibold text-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.20)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#e60000] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  {isWorkerSaving ? "Salvando..." : "Adicionar"}
                </button>
              </form>
            </div>

            <div className="mt-6 rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Lançar Medição</div>
                  <div className="mt-1 text-xs text-slate-500">Hora-homem, diária ou falta.</div>
                </div>
                <button
                  type="button"
                  onClick={() => void loadWorkersAndEntries()}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  Atualizar
                </button>
              </div>

              <form onSubmit={addEntry} className="mt-5 flex flex-col gap-4">
                <label className="flex flex-col gap-2">
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

                <div className="grid grid-cols-2 gap-3">
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
                </div>

                {entryForm.entry_type === "hora_homem" ? (
                  <label className="flex flex-col gap-2">
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

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Observações (opcional)</span>
                  <input
                    value={entryForm.notes}
                    onChange={(e) => setEntryForm((s) => ({ ...s, notes: e.target.value }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                    placeholder="Ex: 2 horas extras"
                  />
                </label>

                <button
                  type="submit"
                  disabled={isEntrySaving || workers.length === 0}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#001f3f] px-5 text-sm font-semibold text-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.20)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#001a33] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <BadgeCheck className="h-4 w-4" />
                  {isEntrySaving ? "Salvando..." : "Registrar"}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Medições Recentes</div>
                  <div className="mt-1 text-xs text-slate-500">Últimos lançamentos (por data).</div>
                </div>
                <div className="text-xs text-slate-500">
                  {isWorkersLoading ? "Atualizando..." : `${entries.length} lançamentos`}
                </div>
              </div>

              <div className="mt-5 overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200/70">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">
                        Colaborador
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">
                        Data
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">
                        Tipo
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold tracking-wide text-slate-700">
                        Horas
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">
                        Observações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.length > 0 ? (
                      entries.map((ev) => {
                        const worker = workerById.get(ev.worker_id);
                        return (
                          <tr key={ev.id} className="border-t border-slate-100">
                            <td className="px-5 py-4">
                              <div className="text-sm font-semibold text-slate-900">
                                {worker?.full_name ?? ev.worker_id}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">{worker?.role ?? "-"}</div>
                            </td>
                            <td className="px-5 py-4 text-sm text-slate-700">{ev.entry_date}</td>
                            <td className="px-5 py-4">
                              <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70">
                                {entryTypeLabel(ev.entry_type)}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right text-sm text-slate-700">
                              {typeof ev.hours === "number" ? ev.hours : "-"}
                            </td>
                            <td className="px-5 py-4 text-sm text-slate-700">{ev.notes ?? "-"}</td>
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
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-slate-500" />
                    <span className="font-semibold text-slate-900">Regra:</span> Hora-homem salva as horas. Diária e Falta salvam sem horas.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
