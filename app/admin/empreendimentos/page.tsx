"use client";

import { useEffect, useMemo, useState } from "react";

import { getSupabaseClient } from "@/lib/supabaseClient";

type Development = {
  id: string;
  name: string;
  cover_url: string | null;
  video_url: string | null;
  sales_material_url: string | null;
  price_table_url: string | null;
  created_at?: string;
};

type FormState = {
  name: string;
  cover_url: string;
  video_url: string;
  sales_material_url: string;
  price_table_url: string;
};

export default function EmpreendimentosPage() {
  const supabase = getSupabaseClient();
  const [rows, setRows] = useState<Development[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAuthorizedOwner, setIsAuthorizedOwner] = useState(false);

  const [form, setForm] = useState<FormState>({
    name: "",
    cover_url: "",
    video_url: "",
    sales_material_url: "",
    price_table_url: "",
  });

  const ownerEmail = useMemo(
    () =>
      (process.env.NEXT_PUBLIC_OWNER_EMAIL ?? "imobmoderna2024@gmail.com").toLowerCase(),
    [],
  );

  async function guardOwner() {
    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      setIsAuthorizedOwner(false);
      return false;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      setErrorMessage(userError.message);
      setIsAuthorizedOwner(false);
      return false;
    }

    const currentEmail = (user?.email ?? "").toLowerCase();
    if (!currentEmail) {
      setErrorMessage("Você precisa entrar para acessar o admin.");
      setIsAuthorizedOwner(false);
      return false;
    }

    if (currentEmail !== ownerEmail) {
      setErrorMessage("Acesso negado: esta área é exclusiva do dono.");
      setIsAuthorizedOwner(false);
      return false;
    }

    setIsAuthorizedOwner(true);
    return true;
  }

  async function load() {
    setIsLoading(true);
    setErrorMessage(null);

    const ok = await guardOwner();
    if (!ok || !supabase) {
      setRows([]);
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("developments")
      .select(
        "id, name, cover_url, video_url, sales_material_url, price_table_url, created_at",
      )
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      setRows([]);
      setIsLoading(false);
      return;
    }

    setRows((data ?? []) as Development[]);
    setIsLoading(false);
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, []);

  async function createDevelopment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    if (!isAuthorizedOwner) {
      setErrorMessage("Acesso negado: esta ação é exclusiva do dono.");
      return;
    }

    setIsSaving(true);

    const payload = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      cover_url: form.cover_url.trim() ? form.cover_url.trim() : null,
      video_url: form.video_url.trim() ? form.video_url.trim() : null,
      sales_material_url: form.sales_material_url.trim()
        ? form.sales_material_url.trim()
        : null,
      price_table_url: form.price_table_url.trim() ? form.price_table_url.trim() : null,
    };

    const { error } = await supabase.from("developments").insert(payload);

    if (error) {
      setErrorMessage(error.message);
      setIsSaving(false);
      return;
    }

    setForm({
      name: "",
      cover_url: "",
      video_url: "",
      sales_material_url: "",
      price_table_url: "",
    });

    setIsSaving(false);
    await load();
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-[#1e3a8a]">
          Empreendimentos
        </h1>
        <p className="text-sm text-zinc-600">
          Lançamentos: loteamentos, residenciais e prédios na planta.
        </p>
      </header>

      {errorMessage ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-semibold text-[#1e3a8a]">Novo empreendimento</div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-[#1e3a8a] hover:bg-zinc-50"
          >
            Recarregar
          </button>
        </div>

        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={createDevelopment}>
          <label className="flex flex-col gap-2 md:col-span-2">
            <span className="text-xs font-medium text-zinc-600">Nome do Empreendimento</span>
            <input
              className="h-11 rounded-lg border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              required
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium text-zinc-600">Logo/Imagem de Capa (URL)</span>
            <input
              className="h-11 rounded-lg border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
              value={form.cover_url}
              onChange={(e) => setForm((s) => ({ ...s, cover_url: e.target.value }))}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium text-zinc-600">Link do Vídeo (principal)</span>
            <input
              className="h-11 rounded-lg border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
              value={form.video_url}
              onChange={(e) => setForm((s) => ({ ...s, video_url: e.target.value }))}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium text-zinc-600">
              Pasta de Material de Venda (Drive/Dropbox)
            </span>
            <input
              className="h-11 rounded-lg border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
              value={form.sales_material_url}
              onChange={(e) => setForm((s) => ({ ...s, sales_material_url: e.target.value }))}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium text-zinc-600">Tabela de Preços (URL)</span>
            <input
              className="h-11 rounded-lg border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
              value={form.price_table_url}
              onChange={(e) => setForm((s) => ({ ...s, price_table_url: e.target.value }))}
            />
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-[#dc2626] px-5 text-sm font-semibold text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Salvando..." : "Cadastrar"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-6 py-4">
          <div className="text-sm font-semibold text-[#1e3a8a]">Empreendimentos cadastrados</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-zinc-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#1e3a8a]">
                  Nome
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#1e3a8a]">
                  Vídeo
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#1e3a8a]">
                  Material
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#1e3a8a]">
                  Tabela de preços
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
              ) : rows.length > 0 ? (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-zinc-200">
                    <td className="px-4 py-4 text-sm text-zinc-900">{r.name}</td>
                    <td className="px-4 py-4 text-sm">
                      {r.video_url ? (
                        <a className="text-[#1e3a8a] underline" href={r.video_url} target="_blank" rel="noreferrer">
                          Abrir
                        </a>
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      {r.sales_material_url ? (
                        <a className="text-[#1e3a8a] underline" href={r.sales_material_url} target="_blank" rel="noreferrer">
                          Abrir
                        </a>
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      {r.price_table_url ? (
                        <a className="text-[#1e3a8a] underline" href={r.price_table_url} target="_blank" rel="noreferrer">
                          Abrir
                        </a>
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-sm text-zinc-600" colSpan={4}>
                    Nenhum empreendimento cadastrado.
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
