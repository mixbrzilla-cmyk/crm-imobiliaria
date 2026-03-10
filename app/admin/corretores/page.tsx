"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getSupabaseClient } from "@/lib/supabaseClient";

type BrokerProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string | null;
  role?: string | null;
};

type BrokerRowView = {
  id: string;
  full_name: string;
  email: string;
  propertiesInHands: number;
  whatsClicks: number;
};

export default function CorretoresAdminPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [rows, setRows] = useState<BrokerRowView[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      .select("id, full_name, email, status, role")
      .eq("role", "broker")
      .order("full_name", { ascending: true });

    if (brokersRes.error) {
      setErrorMessage(brokersRes.error.message);
      setIsLoading(false);
      return;
    }
    const brokerRows = (brokersRes.data ?? []) as BrokerProfile[];

    const propertiesInHandsByBroker = new Map<string, number>();
    const whatsClicksByBroker = new Map<string, number>();

    function addClicks(brokerId: string, value: unknown) {
      const v = typeof value === "number" ? value : Number(value ?? 0);
      if (!Number.isFinite(v)) return;
      whatsClicksByBroker.set(brokerId, (whatsClicksByBroker.get(brokerId) ?? 0) + v);
    }

    const clickColumnsToTry = ["whatsapp_clicks", "whats_clicks", "clicks_whatsapp", "whatsapp_click_count"];

    let propertiesClickColumn: string | null = null;
    for (const col of clickColumnsToTry) {
      const test = await supabase.from("properties").select(`id, corretor_id, ${col}`).limit(1);
      if (!test.error) {
        propertiesClickColumn = col;
        break;
      }
    }

    const propsSelect = propertiesClickColumn
      ? `id, corretor_id, ${propertiesClickColumn}`
      : "id, corretor_id";

    const [propsRes, devsRes] = await Promise.allSettled([
      supabase.from("properties").select(propsSelect),
      (supabase as any).from("developments").select("id, corretor_id"),
    ]);

    if (propsRes.status === "fulfilled" && !propsRes.value.error) {
      const props = (propsRes.value.data ?? []) as Array<any>;
      for (const row of props) {
        const id = (row?.corretor_id ?? "").trim();
        if (!id) continue;
        propertiesInHandsByBroker.set(id, (propertiesInHandsByBroker.get(id) ?? 0) + 1);
        if (propertiesClickColumn) addClicks(id, row?.[propertiesClickColumn]);
      }
    }

    if (devsRes.status === "fulfilled" && !devsRes.value.error) {
      const devs = (devsRes.value.data ?? []) as Array<any>;
      for (const row of devs) {
        const id = (row?.corretor_id ?? "").trim();
        if (!id) continue;
        propertiesInHandsByBroker.set(id, (propertiesInHandsByBroker.get(id) ?? 0) + 1);
      }
    }

    const view: BrokerRowView[] = brokerRows.map((b) => {
      const name = (b.full_name ?? "").trim() || "-";
      const email = (b.email ?? "").trim() || "-";
      const inHands = propertiesInHandsByBroker.get(b.id) ?? 0;
      const clicks = whatsClicksByBroker.get(b.id) ?? 0;
      return {
        id: b.id,
        full_name: name,
        email,
        propertiesInHands: inHands,
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
  }, []);

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

      const releaseDevs = await (supabase as any)
        .from("developments")
        .update({ corretor_id: null })
        .eq("corretor_id", brokerId);
      if (releaseDevs.error) {
        setErrorMessage(releaseDevs.error.message);
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

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-[#1e3a8a]">
          Gestão de Corretores
        </h1>
      </header>

      {errorMessage ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div className="text-sm font-semibold text-[#1e3a8a]">Corretores</div>
          <button
            type="button"
            onClick={() => void loadBaseData()}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-[#1e3a8a] hover:bg-zinc-50"
          >
            Recarregar
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-zinc-50">
                <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-zinc-700">
                  Nome
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-zinc-700">
                  Email
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-zinc-700">
                  Imóveis em Mãos
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-zinc-700">
                  Cliques no Whats (Performance)
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold tracking-wide text-zinc-700">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="px-5 py-6 text-sm text-zinc-600" colSpan={5}>
                    Carregando...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-5 py-6 text-sm text-zinc-600" colSpan={5}>
                    Nenhum corretor encontrado.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-zinc-100">
                    <td className="px-5 py-4 text-sm font-semibold text-zinc-900">{r.full_name}</td>
                    <td className="px-5 py-4 text-sm text-zinc-700">{r.email}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-zinc-900">
                      {r.propertiesInHands}
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-zinc-900">{r.whatsClicks}</td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => void deleteBroker(r.id)}
                        disabled={deletingId === r.id}
                        className="inline-flex h-10 items-center justify-center rounded-lg bg-[#dc2626] px-4 text-sm font-semibold text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingId === r.id ? "Excluindo..." : "Excluir"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
