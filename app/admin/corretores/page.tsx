"use client";

import { useEffect, useState } from "react";

import { getSupabaseClient } from "@/lib/supabaseClient";

type BrokerProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string | null;
  role?: string | null;
};

type Development = {
  id: string;
  name: string;
};

type StandaloneProperty = {
  id: string;
  property_type: string;
  purpose: string;
  address: string | null;
};

export default function CorretoresAdminPage() {
  const supabase = getSupabaseClient();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [brokers, setBrokers] = useState<BrokerProfile[]>([]);
  const [selectedBrokerId, setSelectedBrokerId] = useState<string | null>(null);

  const [developments, setDevelopments] = useState<Development[]>([]);
  const [standalones, setStandalones] = useState<StandaloneProperty[]>([]);

  const [selectedDevelopmentIds, setSelectedDevelopmentIds] = useState<Set<string>>(new Set());
  const [selectedStandaloneIds, setSelectedStandaloneIds] = useState<Set<string>>(new Set());

  async function loadBaseData() {
    setIsLoading(true);
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      setBrokers([]);
      setDevelopments([]);
      setStandalones([]);
      setIsLoading(false);
      return;
    }

    const brokersRes = await supabase
      .from("profiles")
      .select("id, full_name, email, status, role")
      .eq("role", "broker")
      .order("full_name", { ascending: true });

    if (brokersRes.error) {
      setErrorMessage(brokersRes.error.message);
      setIsLoading(false);
      return;
    }

    const devRes = await supabase
      .from("developments")
      .select("id, name")
      .order("name", { ascending: true });

    if (devRes.error) {
      setErrorMessage(devRes.error.message);
      setIsLoading(false);
      return;
    }

    const avRes = await supabase
      .from("standalone_properties")
      .select("id, property_type, purpose, address")
      .order("created_at", { ascending: false });

    if (avRes.error) {
      setErrorMessage(avRes.error.message);
      setIsLoading(false);
      return;
    }

    const brokerRows = (brokersRes.data ?? []) as BrokerProfile[];
    setBrokers(brokerRows);

    const devRows = (devRes.data ?? []) as Development[];
    setDevelopments(devRows);

    const avRows = (avRes.data ?? []) as StandaloneProperty[];
    setStandalones(avRows);

    if (!selectedBrokerId && brokerRows.length > 0) {
      setSelectedBrokerId(brokerRows[0].id);
    }

    setIsLoading(false);
  }

  async function loadPermissions(brokerId: string) {
    setErrorMessage(null);

    if (!supabase) return;

    const devRes = await supabase
      .from("broker_developments")
      .select("development_id")
      .eq("broker_profile_id", brokerId);

    if (devRes.error) {
      setErrorMessage(devRes.error.message);
      return;
    }

    const avRes = await supabase
      .from("broker_standalone_properties")
      .select("standalone_property_id")
      .eq("broker_profile_id", brokerId);

    if (avRes.error) {
      setErrorMessage(avRes.error.message);
      return;
    }

    const devIds = new Set<string>((devRes.data ?? []).map((r) => r.development_id as string));
    const avIds = new Set<string>(
      (avRes.data ?? []).map((r) => r.standalone_property_id as string),
    );

    setSelectedDevelopmentIds(devIds);
    setSelectedStandaloneIds(avIds);
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadBaseData();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!selectedBrokerId) return;

    const timeoutId = setTimeout(() => {
      void loadPermissions(selectedBrokerId);
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [selectedBrokerId]);

  function toggleSet(setter: (next: Set<string>) => void, current: Set<string>, id: string) {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  async function savePermissions() {
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    if (!selectedBrokerId) {
      setErrorMessage("Selecione um corretor.");
      return;
    }

    setIsSaving(true);

    const delDev = await supabase
      .from("broker_developments")
      .delete()
      .eq("broker_profile_id", selectedBrokerId);

    if (delDev.error) {
      setErrorMessage(delDev.error.message);
      setIsSaving(false);
      return;
    }

    const delAv = await supabase
      .from("broker_standalone_properties")
      .delete()
      .eq("broker_profile_id", selectedBrokerId);

    if (delAv.error) {
      setErrorMessage(delAv.error.message);
      setIsSaving(false);
      return;
    }

    const devPayload = Array.from(selectedDevelopmentIds).map((developmentId) => ({
      id: crypto.randomUUID(),
      broker_profile_id: selectedBrokerId,
      development_id: developmentId,
    }));

    const avPayload = Array.from(selectedStandaloneIds).map((propertyId) => ({
      id: crypto.randomUUID(),
      broker_profile_id: selectedBrokerId,
      standalone_property_id: propertyId,
    }));

    if (devPayload.length > 0) {
      const ins = await supabase.from("broker_developments").insert(devPayload);
      if (ins.error) {
        setErrorMessage(ins.error.message);
        setIsSaving(false);
        return;
      }
    }

    if (avPayload.length > 0) {
      const ins = await supabase.from("broker_standalone_properties").insert(avPayload);
      if (ins.error) {
        setErrorMessage(ins.error.message);
        setIsSaving(false);
        return;
      }
    }

    setIsSaving(false);
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-[#1e3a8a]">
          Gestão de Corretores
        </h1>
        <p className="text-sm text-zinc-600">
          Tripulação: veja quem está ativo e distribua a carga (permissões de inventário).
        </p>
      </header>

      {errorMessage ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 px-5 py-4">
            <div className="text-sm font-semibold text-[#1e3a8a]">Corretores</div>
          </div>

          <div className="p-4">
            {isLoading ? (
              <div className="text-sm text-zinc-600">Carregando...</div>
            ) : brokers.length === 0 ? (
              <div className="text-sm text-zinc-600">Nenhum corretor encontrado.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {brokers.map((b) => {
                  const isActive = selectedBrokerId === b.id;
                  const isOk = b.status === "ativo";

                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedBrokerId(b.id)}
                      className={
                        "flex w-full items-start justify-between rounded-lg border px-3 py-3 text-left transition-colors " +
                        (isActive
                          ? "border-[#1e3a8a] bg-[#1e3a8a]/5"
                          : "border-zinc-200 bg-white hover:bg-zinc-50")
                      }
                    >
                      <div className="flex flex-col">
                        <div className="text-sm font-semibold text-zinc-900">
                          {b.full_name ?? "-"}
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-500">{b.email ?? "-"}</div>
                      </div>
                      <div
                        className={
                          "rounded-full px-2 py-1 text-xs font-semibold " +
                          (isOk
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700")
                        }
                      >
                        {b.status ?? "-"}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white lg:col-span-2">
          <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
            <div>
              <div className="text-sm font-semibold text-[#1e3a8a]">Distribuição de Carga</div>
              <div className="mt-0.5 text-xs text-zinc-500">
                Marque o que o corretor pode trabalhar e acessar.
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadBaseData()}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-[#1e3a8a] hover:bg-zinc-50"
              >
                Recarregar
              </button>
              <button
                type="button"
                disabled={isSaving || !selectedBrokerId}
                onClick={() => void savePermissions()}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-[#dc2626] px-4 text-sm font-semibold text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Salvando..." : "Salvar permissões"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-2">
            <div className="rounded-xl border border-zinc-200">
              <div className="border-b border-zinc-200 px-4 py-3">
                <div className="text-xs font-semibold text-[#1e3a8a]">Empreendimentos</div>
              </div>
              <div className="flex max-h-[460px] flex-col gap-2 overflow-auto p-4">
                {isLoading ? (
                  <div className="text-sm text-zinc-600">Carregando...</div>
                ) : developments.length === 0 ? (
                  <div className="text-sm text-zinc-600">Nenhum empreendimento cadastrado.</div>
                ) : (
                  developments.map((d) => (
                    <label
                      key={d.id}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2"
                    >
                      <div className="text-sm text-zinc-900">{d.name}</div>
                      <input
                        type="checkbox"
                        checked={selectedDevelopmentIds.has(d.id)}
                        onChange={() =>
                          toggleSet(setSelectedDevelopmentIds, selectedDevelopmentIds, d.id)
                        }
                      />
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200">
              <div className="border-b border-zinc-200 px-4 py-3">
                <div className="text-xs font-semibold text-[#1e3a8a]">Imóveis Avulsos</div>
              </div>
              <div className="flex max-h-[460px] flex-col gap-2 overflow-auto p-4">
                {isLoading ? (
                  <div className="text-sm text-zinc-600">Carregando...</div>
                ) : standalones.length === 0 ? (
                  <div className="text-sm text-zinc-600">Nenhum imóvel avulso cadastrado.</div>
                ) : (
                  standalones.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2"
                    >
                      <div className="flex flex-col">
                        <div className="text-sm text-zinc-900">
                          {p.property_type} • {p.purpose}
                        </div>
                        <div className="text-xs text-zinc-500">{p.address ?? "-"}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedStandaloneIds.has(p.id)}
                        onChange={() =>
                          toggleSet(setSelectedStandaloneIds, selectedStandaloneIds, p.id)
                        }
                      />
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
