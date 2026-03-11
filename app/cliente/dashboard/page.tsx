"use client";

import { useEffect, useMemo, useState } from "react";

type Preferences = {
  tipo_imovel: string | null;
  valor_max: number | null;
  quartos: number | null;
  bairro: string | null;
};

type Lead = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  cpf: string | null;
  intent: string | null;
  address: string | null;
  stage: string | null;
};

type Suggestion = {
  id: string;
  title: string | null;
  property_type: string | null;
  purpose: string | null;
  price: number | null;
  neighborhood: string | null;
  city: string | null;
  bedrooms: number | null;
};

function formatCurrencyBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export default function ClienteDashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lead, setLead] = useState<Lead | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const title = useMemo(() => lead?.full_name ?? "Cliente", [lead?.full_name]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void (async () => {
        setIsLoading(true);
        setErrorMessage(null);

        try {
          const res = await fetch("/api/cliente/me", { method: "GET" });
          const data = await res.json().catch(() => ({}));

          if (!res.ok) {
            const msg = String(data?.error ?? "Sessão expirada.");
            if (res.status === 401) {
              window.location.href = "/cliente/login";
              return;
            }
            setErrorMessage(msg);
            setLead(null);
            setPreferences(null);
            setSuggestions([]);
            setIsLoading(false);
            return;
          }

          setLead((data?.lead ?? null) as any);
          setPreferences((data?.preferences ?? null) as any);
          setSuggestions(((data?.suggestions ?? []) as any[]) as any);
          setIsLoading(false);
        } catch (e: any) {
          setErrorMessage(e?.message ?? "Falha ao carregar o dashboard.");
          setLead(null);
          setPreferences(null);
          setSuggestions([]);
          setIsLoading(false);
        }
      })();
    }, 0);

    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="flex flex-col gap-1">
          <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">ÁREA DO CLIENTE</div>
          <div className="text-2xl font-semibold tracking-tight text-slate-900">{title}</div>
          <div className="text-sm text-slate-600">Sugestões inteligentes baseadas no seu perfil.</div>
        </div>

        {errorMessage ? (
          <div className="mt-5 rounded-2xl bg-red-50 px-5 py-4 text-sm font-semibold text-red-700 ring-1 ring-red-200/70">
            {errorMessage}
          </div>
        ) : null}

        {isLoading ? (
          <div className="mt-6 rounded-2xl bg-white px-5 py-6 text-sm text-slate-600 ring-1 ring-slate-200/70">
            Carregando...
          </div>
        ) : lead ? (
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/70 lg:col-span-1">
              <div className="text-sm font-semibold text-slate-900">Seus dados</div>
              <div className="mt-3 flex flex-col gap-2 text-sm text-slate-700">
                <div>
                  <span className="font-semibold text-slate-900">Telefone:</span> {lead.phone ?? "-"}
                </div>
                <div>
                  <span className="font-semibold text-slate-900">E-mail:</span> {lead.email ?? "-"}
                </div>
                <div>
                  <span className="font-semibold text-slate-900">Intenção:</span> {lead.intent ?? "-"}
                </div>
                <div>
                  <span className="font-semibold text-slate-900">Etapa:</span> {lead.stage ?? "-"}
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
                <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">PREFERÊNCIAS</div>
                <div className="mt-2 text-sm text-slate-700">
                  <div>
                    <span className="font-semibold text-slate-900">Tipo:</span> {preferences?.tipo_imovel ?? "-"}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Bairro:</span> {preferences?.bairro ?? "-"}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Quartos:</span> {preferences?.quartos ?? "-"}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Até:</span>{" "}
                    {typeof preferences?.valor_max === "number" ? formatCurrencyBRL(preferences.valor_max) : "-"}
                  </div>
                </div>
              </div>

              <a
                href="/cliente/login"
                className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50"
              >
                Trocar acesso
              </a>
            </div>

            <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/70 lg:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Imóveis sugeridos</div>
                  <div className="mt-1 text-xs text-slate-500">Selecionados automaticamente pelo seu perfil.</div>
                </div>
                <div className="text-xs font-semibold tabular-nums text-slate-600">{suggestions.length}</div>
              </div>

              {suggestions.length === 0 ? (
                <div className="mt-4 rounded-xl bg-slate-50 px-4 py-6 text-sm text-slate-600 ring-1 ring-slate-200/70">
                  Nenhuma sugestão ainda. Em breve um corretor pode ajustar suas preferências.
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {suggestions.slice(0, 12).map((p) => (
                    <div key={p.id} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
                      <div className="text-xs font-semibold tracking-wide text-slate-600">
                        {p.property_type ?? "Imóvel"}
                        {p.neighborhood ? ` • ${p.neighborhood}` : ""}
                        {p.city ? ` • ${p.city}` : ""}
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">{p.title ?? "-"}</div>
                      <div className="mt-2 text-xs text-slate-700">
                        {typeof p.price === "number" ? formatCurrencyBRL(p.price) : "Preço: -"}
                        {typeof p.bedrooms === "number" ? ` • ${p.bedrooms} qtos` : ""}
                      </div>
                      <a
                        href="/corretor/whatsapp"
                        className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition-all duration-300 hover:bg-emerald-700"
                      >
                        Falar no WhatsApp
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
