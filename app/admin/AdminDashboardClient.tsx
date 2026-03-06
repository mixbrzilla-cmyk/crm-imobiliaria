"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getSupabaseClient } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  full_name: string | null;
  whatsapp: string | null;
  creci: string | null;
  status: string | null;
};

export default function AdminDashboardClient() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [rows, setRows] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [propertiesCount, setPropertiesCount] = useState<number>(0);

  const hasRows = useMemo(() => rows.length > 0, [rows.length]);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      setRows([]);
      setPendingCount(0);
      setActiveCount(0);
      setPropertiesCount(0);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, whatsapp, creci, status")
        .order("full_name", { ascending: true });

      if (error) {
        setErrorMessage(error.message);
        setRows([]);
        setPendingCount(0);
        setActiveCount(0);
        setPropertiesCount(0);
        setIsLoading(false);
        return;
      }

      const allRows = (data ?? []) as Profile[];
      const pending = allRows.filter((r) => r.status === "pendente").length;
      const active = allRows.filter((r) => r.status === "ativo").length;

      setRows(allRows);
      setPendingCount(pending);
      setActiveCount(active);
      setPropertiesCount(0);
      setIsLoading(false);
    } catch {
      console.log("Silenciando erro de auth");
      setRows([]);
      setPendingCount(0);
      setActiveCount(0);
      setPropertiesCount(0);
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  async function liberarAcesso(profileId: string) {
    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    setUpdatingId(profileId);
    setErrorMessage(null);

    try {
      const { error } = await (supabase as any)
        .from("profiles")
        .update({ status: "ativo" })
        .eq("id", profileId);

      if (error) {
        setErrorMessage(error.message);
        setUpdatingId(null);
        return;
      }
    } catch {
      console.log("Silenciando erro de auth");
      setUpdatingId(null);
      return;
    }

    setRows((current) => current.filter((r) => r.id !== profileId));
    setPendingCount((c) => Math.max(0, c - 1));
    setActiveCount((c) => c + 1);
    setUpdatingId(null);
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-[#1e3a8a]">
          Gestão de Novos Corretores
        </h1>
        <p className="text-sm text-zinc-600">
          Visão geral do fluxo de aprovação e acessos.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="text-sm font-medium text-zinc-600">Pendentes</div>
          <div className="mt-2 text-3xl font-semibold text-[#1e3a8a]">
            {pendingCount}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="text-sm font-medium text-zinc-600">Ativos</div>
          <div className="mt-2 text-3xl font-semibold text-[#1e3a8a]">
            {activeCount}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="text-sm font-medium text-zinc-600">Imóveis</div>
          <div className="mt-2 text-3xl font-semibold text-[#1e3a8a]">
            {propertiesCount}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[#1e3a8a]">Registros em profiles</h2>
            <p className="text-sm text-zinc-600">
              Listagem completa para validar a conexão. Você pode aprovar quem estiver pendente.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-[#1e3a8a] transition-colors hover:bg-zinc-50"
          >
            Recarregar
          </button>
        </div>

        {errorMessage ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-zinc-50">
                <th className="px-4 py-3 text-left text-sm font-semibold text-[#1e3a8a]">
                  Nome
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[#1e3a8a]">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[#1e3a8a]">
                  WhatsApp
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[#1e3a8a]">
                  CRECI
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-[#1e3a8a]">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-zinc-600" colSpan={5}>
                    Carregando...
                  </td>
                </tr>
              ) : hasRows ? (
                (rows ?? []).map((row) => (
                  <tr key={row.id} className="border-t border-zinc-200">
                    <td className="px-4 py-4 text-sm text-zinc-900">
                      {row.full_name ?? "-"}
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-900">
                      {row.status ?? "-"}
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-900">
                      {row.whatsapp ?? "-"}
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-900">
                      {row.creci ?? "-"}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {row.status === "pendente" ? (
                        <button
                          type="button"
                          onClick={() => liberarAcesso(row.id)}
                          disabled={updatingId === row.id}
                          className="inline-flex h-10 items-center justify-center rounded-lg bg-green-600 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {updatingId === row.id ? "Liberando..." : "Liberar Acesso"}
                        </button>
                      ) : (
                        <span className="text-sm text-zinc-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-sm text-zinc-600" colSpan={5}>
                    Nenhum registro encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
