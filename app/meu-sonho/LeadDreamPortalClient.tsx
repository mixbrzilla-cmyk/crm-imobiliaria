"use client";

import { useEffect, useMemo, useState } from "react";

type Lead = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  cpf: string | null;
  intent: string | null;
  address: string | null;
  stage: string | null;
  assigned_broker_profile_id?: string | null;
};

type Preferences = {
  tipo_imovel: string | null;
  valor_max: number | null;
  quartos: number | null;
  bairro: string | null;
};

type BrokerProfile = {
  id: string;
  full_name: string | null;
  creci: string | null;
  avatar_url: string | null;
  regions: string[] | null;
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

function normalizeText(input: string) {
  return String(input ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function extractBairroFromAddress(address: string) {
  const raw = String(address ?? "").trim();
  if (!raw) return "";

  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    const candidate = parts[parts.length - 2] ?? "";
    if (candidate && candidate.length >= 3) return candidate;
  }

  const matchBairro = raw.match(/\bbairro\s+([^,\-\.\n\r]+)/i);
  const fromBairro = String(matchBairro?.[1] ?? "").trim();
  if (fromBairro.length >= 3) return fromBairro;

  const dashParts = raw
    .split("-")
    .map((p) => p.trim())
    .filter(Boolean);
  if (dashParts.length >= 2) {
    const candidate = dashParts[1] ?? "";
    if (candidate.length >= 3) return candidate;
  }

  return raw;
}

function leadNeighborhood(lead: Lead | null, prefs: Preferences | null) {
  const fromPrefs = String(prefs?.bairro ?? "").trim();
  if (fromPrefs) return fromPrefs;
  const fromAddress = lead?.address ? extractBairroFromAddress(lead.address) : "";
  return String(fromAddress ?? "").trim();
}

function progressSteps(stage: string | null | undefined) {
  const s = normalizeText(String(stage ?? ""));
  const isCadastroOk = true;
  const isAnaliseOk = s === "atendimento" || s === "visita" || s === "proposta" || s === "contrato" || s === "vendido";
  const isVisitaOk = s === "visita" || s === "proposta" || s === "contrato" || s === "vendido";
  const isPropostaOk = s === "proposta" || s === "contrato" || s === "vendido";
  return {
    cadastro: isCadastroOk,
    analise: isAnaliseOk,
    visita: isVisitaOk,
    proposta: isPropostaOk,
  };
}

function firstNameFromFullName(fullName: string) {
  const n = String(fullName ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!n) return "";
  return n.split(" ")[0] ?? "";
}

export default function LeadDreamPortalClient() {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [lead, setLead] = useState<Lead | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [broker, setBroker] = useState<BrokerProfile | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void (async () => {
        setIsLoading(true);
        setErrorMessage(null);

        try {
          const res = await fetch("/api/cliente/me", { method: "GET" });
          const data = await res.json().catch(() => ({}));

          if (!res.ok) {
            if (res.status === 401) {
              window.location.href = "/cadastro-detalhado";
              return;
            }

            setErrorMessage(String(data?.error ?? "Não foi possível carregar seu dashboard."));
            setLead(null);
            setPreferences(null);
            setBroker(null);
            setSuggestions([]);
            setIsLoading(false);
            return;
          }

          setLead((data?.lead ?? null) as any);
          setPreferences((data?.preferences ?? null) as any);
          setBroker((data?.broker ?? null) as any);
          setSuggestions(((data?.suggestions ?? []) as any[]) as any);
          setIsLoading(false);
        } catch (e: any) {
          setErrorMessage(e?.message ?? "Falha ao carregar seu dashboard.");
          setLead(null);
          setPreferences(null);
          setBroker(null);
          setSuggestions([]);
          setIsLoading(false);
        }
      })();
    }, 0);

    return () => window.clearTimeout(t);
  }, []);

  const firstName = useMemo(() => {
    const name = String(lead?.full_name ?? "").trim();
    return firstNameFromFullName(name);
  }, [lead?.full_name]);

  const bairro = useMemo(() => leadNeighborhood(lead, preferences), [lead, preferences]);
  const steps = useMemo(() => progressSteps(lead?.stage), [lead?.stage]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-2">
          <div className="text-3xl font-semibold tracking-tight text-slate-900">
            Olá{firstName ? `, ${firstName}` : ""}! Bem-vindo ao seu Dashboard Exclusivo.
          </div>
          <div className="text-sm text-slate-600">
            Ambiente seguro para acompanhar seu atendimento e as oportunidades com maior compatibilidade.
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-6 rounded-2xl bg-red-50 px-5 py-4 text-sm font-semibold text-red-700 ring-1 ring-red-200/70">
            {errorMessage}
          </div>
        ) : null}

        {isLoading ? (
          <div className="mt-6 rounded-2xl bg-white px-5 py-6 text-sm text-slate-600 ring-1 ring-slate-200/70">
            Carregando seu painel...
          </div>
        ) : lead ? (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <div className="rounded-3xl bg-gradient-to-br from-[#001f3f] to-slate-900 p-6 text-white shadow-[0_18px_60px_-34px_rgba(15,23,42,0.55)] ring-1 ring-black/10">
                <div className="text-sm font-semibold tracking-wide text-white/80">STATUS DO ATENDIMENTO</div>
                <div className="mt-3 text-xl font-semibold">Acompanhe a evolução do seu atendimento.</div>

                <div className="mt-4 rounded-2xl bg-white/10 px-4 py-4 text-sm leading-relaxed text-white/90 ring-1 ring-white/15">
                  Esta área utiliza nosso algoritmo de Matching Imobiliário para filtrar oportunidades em tempo real.
                  Analisamos variáveis de localização (Bairro), capacidade financeira e perfil do imóvel para apresentar
                  apenas as unidades que possuem alto índice de compatibilidade com seu cadastro.
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <div className={"rounded-2xl px-4 py-3 ring-1 " + (steps.cadastro ? "bg-white/10 ring-white/15" : "bg-white/5 ring-white/10")}
                  >
                    <div className="text-xs font-semibold tracking-wide text-white/80">Cadastro</div>
                    <div className="mt-1 text-sm font-semibold">OK</div>
                  </div>
                  <div className={"rounded-2xl px-4 py-3 ring-1 " + (steps.analise ? "bg-white/10 ring-white/15" : "bg-white/5 ring-white/10")}
                  >
                    <div className="text-xs font-semibold tracking-wide text-white/80">Análise de Perfil</div>
                    <div className="mt-1 text-sm font-semibold">Em curso</div>
                  </div>
                  <div className={"rounded-2xl px-4 py-3 ring-1 " + (steps.visita ? "bg-white/10 ring-white/15" : "bg-white/5 ring-white/10")}
                  >
                    <div className="text-xs font-semibold tracking-wide text-white/80">Visita</div>
                    <div className="mt-1 text-sm font-semibold">{steps.visita ? "Em curso" : "Próximo"}</div>
                  </div>
                  <div className={"rounded-2xl px-4 py-3 ring-1 " + (steps.proposta ? "bg-white/10 ring-white/15" : "bg-white/5 ring-white/10")}
                  >
                    <div className="text-xs font-semibold tracking-wide text-white/80">Proposta</div>
                    <div className="mt-1 text-sm font-semibold">{steps.proposta ? "Em curso" : "Próximo"}</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-3xl bg-white p-6 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/70">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Imóveis Selecionados</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Baseados no seu perfil de valor e intenção.
                    </div>
                  </div>
                  <div className="text-xs font-semibold tabular-nums text-slate-600">{suggestions.length}</div>
                </div>

                {suggestions.length === 0 ? (
                  <div className="mt-5 rounded-2xl bg-slate-50 px-5 py-6 text-sm text-slate-600 ring-1 ring-slate-200/70">
                    Estamos preparando sua vitrine personalizada. Em breve você verá imóveis aqui.
                  </div>
                ) : (
                  <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {suggestions.slice(0, 10).map((p) => (
                      <div
                        key={p.id}
                        className="overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200/70"
                      >
                        <div className="h-44 w-full bg-gradient-to-br from-slate-200 to-slate-100" />
                        <div className="p-5">
                          <div className="flex flex-wrap items-center gap-2 text-[12px] font-semibold text-slate-600">
                            <span className="rounded-full bg-slate-100 px-3 py-1 ring-1 ring-slate-200/70">
                              {p.property_type ?? "Imóvel"}
                            </span>
                            {typeof p.bedrooms === "number" ? (
                              <span className="rounded-full bg-slate-100 px-3 py-1 ring-1 ring-slate-200/70">
                                {p.bedrooms} dormitórios
                              </span>
                            ) : null}
                            <span className="rounded-full bg-slate-100 px-3 py-1 ring-1 ring-slate-200/70">
                              {p.neighborhood || "Localização"}
                              {p.city ? ` · ${p.city}` : ""}
                            </span>
                          </div>

                          <div className="mt-3 text-base font-semibold text-slate-900">
                            {p.title ?? "Unidade com alta compatibilidade"}
                          </div>

                          <div className="mt-2 text-sm font-semibold text-emerald-700">
                            {typeof p.price === "number" ? formatCurrencyBRL(p.price) : "Valor sob consulta"}
                          </div>

                          <div className="mt-3 grid grid-cols-1 gap-1 text-xs text-slate-600">
                            <div>
                              <span className="font-semibold text-slate-900">Localização:</span> {p.neighborhood || "-"}
                              {p.city ? `, ${p.city}` : ""}
                            </div>
                            <div>
                              <span className="font-semibold text-slate-900">Tipologia:</span> {p.property_type || "-"}
                            </div>
                          </div>

                          <button
                            type="button"
                            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-[#001f3f] px-5 text-sm font-semibold text-white shadow-[0_10px_24px_-18px_rgba(15,23,42,0.55)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#001a33]"
                          >
                            Solicitar Análise Técnica
                          </button>

                          <button
                            type="button"
                            className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-white px-5 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50"
                          >
                            Agendar Visita Especializada
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-4">
              <div className="rounded-3xl bg-white p-6 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/70">
                <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">SEU CONSULTOR ESPECIALISTA</div>

                {broker ? (
                  <div className="mt-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-2xl bg-slate-100 ring-1 ring-slate-200/70" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{broker.full_name ?? "Corretor"}</div>
                        <div className="mt-1 text-xs text-slate-500">{broker.creci ? `CRECI ${broker.creci}` : "Especialista"}</div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200/70">
                      Região: <span className="font-semibold text-slate-900">{bairro || "sua região"}</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200/70">
                    Estamos selecionando o melhor especialista para você...
                  </div>
                )}

                <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700 ring-1 ring-slate-200/70">
                  <div className="font-semibold text-slate-900">Seu perfil</div>
                  <div className="mt-2 flex flex-col gap-1 text-sm">
                    <div>
                      <span className="font-semibold text-slate-900">Intenção:</span> {lead.intent ?? preferences?.tipo_imovel ?? "-"}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900">Local:</span> {bairro || "-"}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900">Valor máx.:</span>{" "}
                      {typeof preferences?.valor_max === "number" ? formatCurrencyBRL(preferences.valor_max) : "-"}
                    </div>
                  </div>
                </div>

                <a
                  href="/cliente/login"
                  className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-white px-5 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50"
                >
                  Trocar acesso
                </a>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
