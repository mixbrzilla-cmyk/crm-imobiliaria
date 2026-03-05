"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  full_name: string | null;
  whatsapp: string | null;
  creci: string | null;
  status: string | null;
};

export default function AdminPage() {
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

    const [{ data: pendingRows, error: pendingRowsError }, pendingCountRes, activeCountRes] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, whatsapp, creci, status")
          .eq("status", "pendente")
          .order("full_name", { ascending: true }),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("status", "pendente"),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("status", "ativo"),
      ]);

    if (pendingRowsError) {
      setErrorMessage(pendingRowsError.message);
      setRows([]);
      setPendingCount(0);
      setActiveCount(0);
      setIsLoading(false);
      return;
    }

    setRows((pendingRows ?? []) as Profile[]);
    setPendingCount(pendingCountRes.count ?? 0);
    setActiveCount(activeCountRes.count ?? 0);
    setPropertiesCount(0);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadDashboard();
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [loadDashboard]);

  async function liberarAcesso(profileId: string) {
    setUpdatingId(profileId);
    setErrorMessage(null);

    const { error } = await supabase
      .from("profiles")
      .update({ status: "ativo" })
      .eq("id", profileId);

    if (error) {
      setErrorMessage(error.message);
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
            {isLoading ? "..." : pendingCount}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="text-sm font-medium text-zinc-600">Ativos</div>
          <div className="mt-2 text-3xl font-semibold text-[#1e3a8a]">
            {isLoading ? "..." : activeCount}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="text-sm font-medium text-zinc-600">Imóveis</div>
          <div className="mt-2 text-3xl font-semibold text-[#1e3a8a]">
            {isLoading ? "..." : propertiesCount}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[#1e3a8a]">Aprovações pendentes</h2>
            <p className="text-sm text-zinc-600">
              Abaixo estão os corretores aguardando liberação.
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
                  <td className="px-4 py-6 text-sm text-zinc-600" colSpan={4}>
                    Carregando...
                  </td>
                </tr>
              ) : hasRows ? (
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-zinc-200">
                    <td className="px-4 py-4 text-sm text-zinc-900">
                      {row.full_name ?? "-"}
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-900">
                      {row.whatsapp ?? "-"}
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-900">
                      {row.creci ?? "-"}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => liberarAcesso(row.id)}
                        disabled={updatingId === row.id}
                        className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {updatingId === row.id ? "Liberando..." : "Liberar Acesso"}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-sm text-zinc-600" colSpan={4}>
                    Nenhum corretor pendente no momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-zinc-500">
          Fundo branco. Menu azul escuro. Ações de sucesso em verde.
        </div>
      </section>
    </div>
  );
}
