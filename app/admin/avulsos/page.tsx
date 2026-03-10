"use client";

import { useEffect, useMemo, useState } from "react";

import { getSupabaseClient } from "@/lib/supabaseClient";

type PropertyPurpose = "venda" | "locacao";

type StandaloneProperty = {
  id: string;
  property_type: string;
  purpose: PropertyPurpose;
  price: number | null;
  address: string | null;
  photos_urls: string[] | null;
  description: string | null;
  is_premium?: boolean | null;
  corretor_id?: string | null;
  created_at?: string;
};

type BrokerProfile = {
  id: string;
  full_name: string | null;
  status: string | null;
  status_aprovacao?: string | null;
  role?: string | null;
};

type FormState = {
  property_type: string;
  purpose: PropertyPurpose;
  price: string;
  address: string;
  corretor_id: string;
  is_premium: boolean;
  photos_urls: string;
  description: string;
};

export default function ImoveisAvulsosPage() {
  const supabase = getSupabaseClient();
  const [rows, setRows] = useState<StandaloneProperty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [brokers, setBrokers] = useState<BrokerProfile[]>([]);
  const [dispatchSelectionById, setDispatchSelectionById] = useState<Record<string, string>>({});
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);

  const brokerById = useMemo(() => {
    const map = new Map<string, BrokerProfile>();
    for (const b of brokers) map.set(b.id, b);
    return map;
  }, [brokers]);

  const [form, setForm] = useState<FormState>({
    property_type: "Casa",
    purpose: "venda",
    price: "",
    address: "",
    corretor_id: "",
    is_premium: false,
    photos_urls: "",
    description: "",
  });

  async function load() {
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

    const res = await supabase
      .from("standalone_properties")
      .select(
        "id, property_type, purpose, price, address, photos_urls, description, is_premium, corretor_id, created_at",
      )
      .order("created_at", { ascending: false });

    if (res.error) {
      setErrorMessage(res.error.message);
      setRows([]);
      setIsLoading(false);
      return;
    }

    setRows((res.data ?? []) as StandaloneProperty[]);

    setIsLoading(false);
  }

  async function loadBrokers() {
    if (!supabase) {
      setBrokers([]);
      return;
    }

    try {
      let res: any = await supabase
        .from("profiles")
        .select("id, full_name, status, status_aprovacao, role")
        .eq("role", "broker")
        .order("full_name", { ascending: true });

      if (res.error) {
        res = await supabase
          .from("profiles")
          .select("id, full_name, status, role")
          .eq("role", "broker")
          .order("full_name", { ascending: true });
      }

      if (res.error) {
        setBrokers([]);
        return;
      }

      const all = (res.data ?? []) as BrokerProfile[];
      const eligible = all.filter((b) => {
        const status = (b.status ?? "").toLowerCase();
        const aprov = (b.status_aprovacao ?? "").toLowerCase();
        if (aprov) return aprov === "aprovado";
        return status === "ativo" || status === "aprovado";
      });
      setBrokers(eligible);
    } catch {
      setBrokers([]);
    }
  }

  async function logDispatch(targetType: string, targetId: string, brokerId: string) {
    if (!supabase) return;
    try {
      await (supabase as any).from("interaction_logs").insert({
        id: crypto.randomUUID(),
        event_type: "dispatch_to_broker",
        target_type: targetType,
        target_id: targetId,
        broker_profile_id: brokerId,
        created_at: new Date().toISOString(),
      });
    } catch {
      return;
    }
  }

  async function dispatchToBroker(propertyId: string) {
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    const brokerId = (dispatchSelectionById[propertyId] ?? "").trim();
    if (!brokerId) {
      setErrorMessage("Selecione um corretor.");
      return;
    }

    setDispatchingId(propertyId);

    try {
      const { error } = await (supabase as any)
        .from("standalone_properties")
        .update({ corretor_id: brokerId })
        .eq("id", propertyId);

      if (error) {
        setErrorMessage(error.message);
        setDispatchingId(null);
        return;
      }

      void logDispatch("standalone_property", propertyId, brokerId);

      setRows((current) => current.map((r) => (r.id === propertyId ? { ...r, corretor_id: brokerId } : r)));
    } catch {
      setErrorMessage("Não foi possível enviar ao corretor agora.");
    } finally {
      setDispatchingId(null);
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void load();
      void loadBrokers();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, []);

  async function createProperty(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    setIsSaving(true);

    const normalizedPrice = form.price.trim() ? Number(form.price.trim()) : null;
    const photos = form.photos_urls
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const payload = {
      id: crypto.randomUUID(),
      property_type: form.property_type.trim(),
      purpose: form.purpose,
      price: Number.isFinite(normalizedPrice as number) ? normalizedPrice : null,
      address: form.address.trim() ? form.address.trim() : null,
      corretor_id: form.corretor_id.trim() ? form.corretor_id.trim() : null,
      is_premium: form.is_premium,
      photos_urls: photos.length ? photos : null,
      description: form.description.trim() ? form.description.trim() : null,
    };

    const { error } = await (supabase as any)
      .from("standalone_properties")
      .insert(payload);

    if (error) {
      setErrorMessage(error.message);
      setIsSaving(false);
      return;
    }

    setForm({
      property_type: "Casa",
      purpose: "venda",
      price: "",
      address: "",
      corretor_id: "",
      is_premium: false,
      photos_urls: "",
      description: "",
    });

    setIsSaving(false);
    await load();
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-[#1e3a8a]">
          Imóveis Avulsos
        </h1>
        <p className="text-sm text-zinc-600">
          Casas, apartamentos e pontos comerciais (venda ou locação).
        </p>
      </header>

      {errorMessage ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-semibold text-[#1e3a8a]">Novo imóvel avulso</div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-[#1e3a8a] hover:bg-zinc-50"
          >
            Recarregar
          </button>
        </div>

        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={createProperty}>
          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium text-zinc-600">Tipo de Imóvel</span>
            <input
              className="h-11 rounded-lg border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
              value={form.property_type}
              onChange={(e) => setForm((s) => ({ ...s, property_type: e.target.value }))}
              required
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium text-zinc-600">Finalidade</span>
            <select
              className="h-11 rounded-lg border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
              value={form.purpose}
              onChange={(e) =>
                setForm((s) => ({ ...s, purpose: e.target.value as PropertyPurpose }))
              }
            >
              <option value="venda">Venda</option>
              <option value="locacao">Locação</option>
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium text-zinc-600">Preço</span>
            <input
              className="h-11 rounded-lg border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
              value={form.price}
              onChange={(e) => setForm((s) => ({ ...s, price: e.target.value }))}
              inputMode="decimal"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium text-zinc-600">Endereço</span>
            <input
              className="h-11 rounded-lg border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
              value={form.address}
              onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium text-zinc-600">Corretor Responsável</span>
            <select
              className="h-11 rounded-lg border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
              value={form.corretor_id}
              onChange={(e) => setForm((s) => ({ ...s, corretor_id: e.target.value }))}
            >
              <option value="">Sem corretor</option>
              {brokers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.full_name ?? b.id}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 md:col-span-2">
            <input
              type="checkbox"
              checked={form.is_premium}
              onChange={(e) => setForm((s) => ({ ...s, is_premium: e.target.checked }))}
              className="h-4 w-4"
            />
            <span className="text-sm">Marcar como Imóvel Premium (Destaque Dashboard)</span>
          </label>

          <label className="flex flex-col gap-2 md:col-span-2">
            <span className="text-xs font-medium text-zinc-600">Fotos (1 URL por linha)</span>
            <textarea
              className="min-h-24 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
              value={form.photos_urls}
              onChange={(e) => setForm((s) => ({ ...s, photos_urls: e.target.value }))}
            />
          </label>

          <label className="flex flex-col gap-2 md:col-span-2">
            <span className="text-xs font-medium text-zinc-600">Descrição</span>
            <textarea
              className="min-h-28 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
              value={form.description}
              onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
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
          <div className="text-sm font-semibold text-[#1e3a8a]">Imóveis cadastrados</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-zinc-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#1e3a8a]">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#1e3a8a]">Finalidade</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#1e3a8a]">Preço</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#1e3a8a]">Endereço</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#1e3a8a]">Premium</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#1e3a8a]">Enviar ao Corretor</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-zinc-600" colSpan={6}>
                    Carregando...
                  </td>
                </tr>
              ) : rows.length > 0 ? (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-zinc-200">
                    <td className="px-4 py-4 text-sm text-zinc-900">{r.property_type}</td>
                    <td className="px-4 py-4 text-sm text-zinc-900">{r.purpose}</td>
                    <td className="px-4 py-4 text-sm text-zinc-900">
                      {typeof r.price === "number" ? r.price.toLocaleString("pt-BR") : "-"}
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-900">{r.address ?? "-"}</td>
                    <td className="px-4 py-4 text-sm text-zinc-900">{r.is_premium ? "Sim" : "-"}</td>
                    <td className="px-4 py-4 text-sm">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <select
                            value={dispatchSelectionById[r.id] ?? r.corretor_id ?? ""}
                            onChange={(e) =>
                              setDispatchSelectionById((c) => ({ ...c, [r.id]: e.target.value }))
                            }
                            disabled={false}
                            className="h-10 w-56 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20 disabled:cursor-not-allowed disabled:bg-zinc-50"
                          >
                            <option value="">Selecione</option>
                            {brokers.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.full_name ?? b.id}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => void dispatchToBroker(r.id)}
                            disabled={dispatchingId === r.id}
                            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#001f3f] px-4 text-sm font-semibold text-white hover:bg-[#001a33] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {dispatchingId === r.id ? "Enviando..." : "Confirmar"}
                          </button>
                        </div>

                        {r.corretor_id ? (
                          <div className="text-xs text-zinc-600">
                            Enviado para:{" "}
                            <span className="font-semibold text-zinc-900">
                              {brokerById.get(r.corretor_id ?? "")?.full_name ?? "-"}
                            </span>
                          </div>
                        ) : null}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-6 text-sm text-zinc-600" colSpan={6}>
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
