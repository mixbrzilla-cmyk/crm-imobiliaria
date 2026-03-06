"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getSupabaseClient } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  full_name: string | null;
  status: string | null;
  role: string | null;
};

export default function CorretorHomePage() {
  const supabase = getSupabaseClient();
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [brokers, setBrokers] = useState<Profile[]>([]);
  const [selectedBrokerId, setSelectedBrokerId] = useState<string>("");

  const selectedBroker = useMemo(
    () => brokers.find((b) => b.id === selectedBrokerId) ?? null,
    [brokers, selectedBrokerId],
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void (async () => {
        setIsLoading(true);
        setErrorMessage(null);

        if (!supabase) {
          setErrorMessage(
            "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
          );
          setBrokers([]);
          setSelectedBrokerId("");
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, status, role")
          .eq("role", "broker")
          .order("full_name", { ascending: true });

        if (error) {
          setErrorMessage(error.message);
          setBrokers([]);
          setIsLoading(false);
          return;
        }

        const rows = (data ?? []) as Profile[];
        setBrokers(rows);

        const saved = window.localStorage.getItem("active_broker_profile_id") ?? "";
        const initial = saved && rows.some((r) => r.id === saved) ? saved : rows[0]?.id ?? "";
        setSelectedBrokerId(initial);
        if (initial) window.localStorage.setItem("active_broker_profile_id", initial);
        setIsLoading(false);
      })();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, []);

  function onChangeBroker(nextId: string) {
    setSelectedBrokerId(nextId);
    window.localStorage.setItem("active_broker_profile_id", nextId);
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex flex-col">
            <div className="text-sm font-semibold text-[#1e3a8a]">Área do Corretor</div>
            <div className="text-xs text-zinc-500">CRM Operacional</div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/corretor/clientes"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-[#1e3a8a] hover:bg-zinc-50"
            >
              Meus Clientes
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        {isLoading ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
            Carregando...
          </div>
        ) : errorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-6 md:col-span-2">
              <div className="text-lg font-semibold text-[#1e3a8a]">Área Operacional</div>
              <div className="mt-1 text-sm text-zinc-600">
                Selecione o corretor para operar e acesse o Kanban de clientes.
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-zinc-600">Corretor</span>
                  <select
                    className="h-11 rounded-lg border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
                    value={selectedBrokerId}
                    onChange={(e) => onChangeBroker(e.target.value)}
                    disabled={brokers.length === 0}
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
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
                  <div className="text-xs font-medium text-zinc-600">Status</div>
                  <div className="mt-1 text-sm font-semibold text-zinc-900">
                    {selectedBroker?.status ?? "-"}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/corretor/clientes"
                  className="inline-flex h-11 items-center justify-center rounded-lg bg-[#1e3a8a] px-5 text-sm font-semibold text-white hover:opacity-95"
                >
                  Abrir Kanban de Clientes
                </Link>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <div className="text-sm font-medium text-zinc-600">Próximos passos</div>
              <div className="mt-3 space-y-2 text-sm text-zinc-700">
                <div>1. Cadastre seu lead</div>
                <div>2. Registre as interações</div>
                <div>3. Atualize o status no Kanban</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
