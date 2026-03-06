"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getSupabaseClient } from "@/lib/supabaseClient";

type LeadStage = "atendimento" | "visita" | "proposta";

type LeadRow = {
  id: string;
  owner_broker_profile_id: string;
  full_name: string;
  phone: string;
  interest: string | null;
  stage: LeadStage;
  created_at?: string;
};

type NewLeadForm = {
  full_name: string;
  phone: string;
  interest: string;
};

const STAGES: Array<{ key: LeadStage; label: string }> = [
  { key: "atendimento", label: "Atendimento" },
  { key: "visita", label: "Visita" },
  { key: "proposta", label: "Proposta" },
];

export default function MeusClientesPage() {
  const supabase = getSupabaseClient();
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [brokers, setBrokers] = useState<Array<{ id: string; full_name: string | null }>>([]);
  const [brokerId, setBrokerId] = useState<string>("");
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null);

  const [form, setForm] = useState<NewLeadForm>({
    full_name: "",
    phone: "",
    interest: "",
  });
  const [isCreating, setIsCreating] = useState(false);

  const grouped = useMemo(() => {
    const base: Record<LeadStage, LeadRow[]> = {
      atendimento: [],
      visita: [],
      proposta: [],
    };

    for (const lead of leads) base[lead.stage]?.push(lead);

    for (const stageKey of Object.keys(base) as LeadStage[]) {
      base[stageKey].sort((a, b) => a.full_name.localeCompare(b.full_name));
    }

    return base;
  }, [leads]);

  async function load() {
    setIsLoading(true);
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      setBrokers([]);
      setBrokerId("");
      setLeads([]);
      setIsLoading(false);
      return;
    }

    const brokersRes = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "broker")
      .order("full_name", { ascending: true });

    if (brokersRes.error) {
      setErrorMessage(brokersRes.error.message);
      setIsLoading(false);
      return;
    }

    const brokerRows = (brokersRes.data ?? []) as Array<{ id: string; full_name: string | null }>;
    setBrokers(brokerRows);

    const saved = window.localStorage.getItem("active_broker_profile_id") ?? "";
    const initial = saved && brokerRows.some((b) => b.id === saved) ? saved : brokerRows[0]?.id ?? "";
    setBrokerId(initial);
    if (initial) window.localStorage.setItem("active_broker_profile_id", initial);

    if (!initial) {
      setLeads([]);
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("leads")
      .select("id, owner_broker_profile_id, full_name, phone, interest, stage")
      .eq("owner_broker_profile_id", initial)
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      setLeads([]);
      setIsLoading(false);
      return;
    }

    setLeads((data ?? []) as LeadRow[]);
    setIsLoading(false);
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void load();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, []);

  async function criarLead(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    if (!brokerId) {
      setErrorMessage("Selecione um corretor para cadastrar leads.");
      return;
    }

    setIsCreating(true);

    try {
      const payload = {
        id: crypto.randomUUID(),
        owner_broker_profile_id: brokerId,
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        interest: form.interest.trim() ? form.interest.trim() : null,
        stage: "atendimento" as const,
        source: "corretor" as const,
      };

      const { error } = await (supabase as any).from("leads").insert(payload);
      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setForm({ full_name: "", phone: "", interest: "" });
      await load();
    } catch {
      setErrorMessage("Não foi possível cadastrar o lead. Tente novamente.");
    } finally {
      setIsCreating(false);
    }
  }

  async function moverLead(leadId: string, stage: LeadStage) {
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    setMovingLeadId(leadId);

    const { error } = await (supabase as any)
      .from("leads")
      .update({ stage })
      .eq("id", leadId);

    if (error) {
      setErrorMessage(error.message);
      setMovingLeadId(null);
      return;
    }

    setLeads((current) => current.map((l) => (l.id === leadId ? { ...l, stage } : l)));
    setMovingLeadId(null);
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex flex-col">
            <div className="text-sm font-semibold text-[#1e3a8a]">Meus Clientes</div>
            <div className="text-xs text-zinc-500">Kanban operacional de atendimento</div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/corretor"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-[#1e3a8a] hover:bg-zinc-50"
            >
              Voltar
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#1e3a8a] px-4 text-sm font-semibold text-white hover:opacity-95"
            >
              Recarregar
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        {errorMessage ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <div className="text-sm font-semibold text-[#1e3a8a]">Novo lead</div>

            <label className="mt-4 flex flex-col gap-2">
              <span className="text-xs font-medium text-zinc-600">Corretor</span>
              <select
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
                value={brokerId}
                onChange={(e) => {
                  const next = e.target.value;
                  setBrokerId(next);
                  window.localStorage.setItem("active_broker_profile_id", next);
                  void load();
                }}
                disabled={isLoading || brokers.length === 0}
              >
                {brokers.length === 0 ? (
                  <option value="">Nenhum corretor encontrado</option>
                ) : (
                  brokers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.full_name ?? b.id}
                    </option>
                  ))
                )}
              </select>
            </label>

            <form className="mt-4 flex flex-col gap-3" onSubmit={criarLead}>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-medium text-zinc-600">Nome</span>
                <input
                  className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
                  value={form.full_name}
                  onChange={(e) => setForm((s) => ({ ...s, full_name: e.target.value }))}
                  required
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-medium text-zinc-600">Telefone</span>
                <input
                  className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
                  value={form.phone}
                  onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                  required
                  inputMode="tel"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-medium text-zinc-600">Interesse</span>
                <input
                  className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
                  value={form.interest}
                  onChange={(e) => setForm((s) => ({ ...s, interest: e.target.value }))}
                />
              </label>

              <button
                type="submit"
                disabled={isLoading || isCreating || !brokerId}
                className="mt-2 inline-flex h-10 items-center justify-center rounded-lg bg-[#dc2626] px-4 text-sm font-semibold text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreating ? "Cadastrando..." : "Cadastrar"}
              </button>
            </form>
          </div>

          <div className="lg:col-span-3">
            {isLoading ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
                Carregando...
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                {STAGES.map((stage) => (
                  <div key={stage.key} className="rounded-xl border border-zinc-200 bg-white">
                    <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
                      <div className="text-sm font-semibold text-[#1e3a8a]">{stage.label}</div>
                      <div className="text-xs text-zinc-500">{grouped[stage.key].length}</div>
                    </div>

                    <div className="flex flex-col gap-3 p-4">
                      {grouped[stage.key].length === 0 ? (
                        <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-3 py-4 text-xs text-zinc-500">
                          Sem leads nessa etapa.
                        </div>
                      ) : null}

                      {grouped[stage.key].map((lead) => (
                        <div
                          key={lead.id}
                          className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
                        >
                          <div className="text-sm font-semibold text-zinc-900">
                            {lead.full_name}
                          </div>
                          <div className="mt-1 text-xs text-zinc-600">{lead.phone}</div>
                          {lead.interest ? (
                            <div className="mt-2 text-xs text-zinc-600">
                              Interesse: <span className="font-medium text-zinc-800">{lead.interest}</span>
                            </div>
                          ) : null}

                          <div className="mt-4 flex flex-wrap gap-2">
                            {STAGES.filter((s) => s.key !== stage.key).map((target) => (
                              <button
                                key={target.key}
                                type="button"
                                disabled={movingLeadId === lead.id}
                                onClick={() => void moverLead(lead.id, target.key)}
                                className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-[#1e3a8a] hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {movingLeadId === lead.id ? "Movendo..." : `Mover p/ ${target.label}`}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
