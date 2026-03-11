"use client";

import { useEffect, useMemo, useState } from "react";

import { getSupabaseClient } from "@/lib/supabaseClient";

type Intent = "comprar" | "alugar";

type StepperState = {
  nome: string;
  telefone: string;
  cpf: string;
  endereco: string;
  intent: Intent;
  bairros: string;
  valorMax: string;
  quartos: string;
  senha: string;
};

function onlyDigits(v: string) {
  return String(v ?? "").replace(/\D+/g, "");
}

function sanitizePhone(v: string) {
  return String(v ?? "").replace(/[^0-9+]/g, "").trim();
}

function parseMoneyToNumberBR(input: string) {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const num = Number(normalized);
  if (!Number.isFinite(num)) return null;
  return num;
}

function toIntOrNull(input: string) {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function inferStoredValue(keys: string[]) {
  if (typeof window === "undefined") return "";
  for (const k of keys) {
    try {
      const v = window.localStorage.getItem(k);
      if (v && String(v).trim()) return String(v).trim();
    } catch {
      // ignore
    }
  }
  return "";
}

export default function CadastroDetalhadoPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [state, setState] = useState<StepperState>({
    nome: "",
    telefone: "",
    cpf: "",
    endereco: "",
    intent: "comprar",
    bairros: "",
    valorMax: "",
    quartos: "",
    senha: "",
  });

  useEffect(() => {
    const nome = inferStoredValue([
      "lp_nome",
      "lead_nome",
      "lead_name",
      "nome",
      "name",
      "full_name",
      "lead.full_name",
      "crm_lead_nome",
    ]);

    const telefone = inferStoredValue([
      "lp_telefone",
      "lead_telefone",
      "lead_phone",
      "telefone",
      "phone",
      "whatsapp",
      "lead.phone",
      "crm_lead_telefone",
    ]);

    setState((s) => ({
      ...s,
      nome: s.nome || nome,
      telefone: s.telefone || telefone,
    }));
  }, []);

  const steps = useMemo(
    () => [
      { key: "contato", title: "Seu contato" },
      { key: "cpf", title: "CPF" },
      { key: "endereco", title: "Endereço" },
      { key: "intent", title: "Intenção" },
      { key: "prefs", title: "Preferências" },
      { key: "senha", title: "Senha" },
    ],
    [],
  );

  const progress = useMemo(() => {
    const max = steps.length;
    const pct = Math.round(((step + 1) / max) * 100);
    return Math.min(100, Math.max(0, pct));
  }, [step, steps.length]);

  function next() {
    setErrorMessage(null);

    if (step === 0) {
      const nome = state.nome.trim();
      const telefone = sanitizePhone(state.telefone);
      if (!nome || !telefone) {
        setErrorMessage("Informe seu nome e telefone.");
        return;
      }
    }

    if (step === 1) {
      const cpf = onlyDigits(state.cpf);
      if (cpf.length < 11) {
        setErrorMessage("Informe um CPF válido.");
        return;
      }
    }

    if (step === 2) {
      if (!state.endereco.trim()) {
        setErrorMessage("Informe seu endereço.");
        return;
      }
    }

    if (step === 4) {
      const valor = parseMoneyToNumberBR(state.valorMax);
      if (state.valorMax.trim() && valor == null) {
        setErrorMessage("Informe um valor máximo válido.");
        return;
      }
      const quartos = toIntOrNull(state.quartos);
      if (state.quartos.trim() && quartos == null) {
        setErrorMessage("Informe o número de quartos.");
        return;
      }
    }

    if (step === 5) {
      if (state.senha.trim().length < 6) {
        setErrorMessage("Sua senha precisa ter pelo menos 6 caracteres.");
        return;
      }
    }

    setStep((s) => Math.min(s + 1, steps.length - 1));
  }

  function back() {
    setErrorMessage(null);
    setStep((s) => Math.max(0, s - 1));
  }

  async function finish() {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const cpfDigits = onlyDigits(state.cpf);
      const telefone = sanitizePhone(state.telefone);

      const valorMax = parseMoneyToNumberBR(state.valorMax);
      const quartos = toIntOrNull(state.quartos);
      const bairro = state.bairros.trim();

      const leadPayload = {
        nome: state.nome.trim(),
        telefone,
        cpf: cpfDigits,
        address: state.endereco.trim(),
        intent: state.intent,
        customer_preferences: {
          bairro: bairro || null,
          valor_max: valorMax,
          quartos,
        },
      };

      const leadRes = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leadPayload),
      });

      const leadData = await leadRes.json().catch(() => ({}));
      if (!leadRes.ok || !leadData?.ok) {
        setErrorMessage(String(leadData?.error ?? "Não foi possível salvar seu cadastro."));
        setIsSubmitting(false);
        return;
      }

      if (!supabase) {
        setErrorMessage("Supabase não configurado.");
        setIsSubmitting(false);
        return;
      }

      const pseudoEmail = `${cpfDigits}@cliente.crm.local`;
      const signUpRes = await supabase.auth.signUp({
        email: pseudoEmail,
        password: state.senha,
        options: {
          data: {
            cpf: cpfDigits,
            phone: telefone,
            full_name: state.nome.trim(),
          },
        },
      });

      if (signUpRes.error) {
        setErrorMessage(signUpRes.error.message);
        setIsSubmitting(false);
        return;
      }

      const sessionRes = await fetch("/api/cliente/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "cpf",
          cpf: cpfDigits,
          phone: telefone,
        }),
      });

      if (!sessionRes.ok) {
        const sessionData = await sessionRes.json().catch(() => ({}));
        setErrorMessage(String(sessionData?.error ?? "Cadastro ok, mas falhou ao iniciar sessão."));
        setIsSubmitting(false);
        return;
      }

      window.location.href = "/cliente/dashboard";
    } catch (e: any) {
      setErrorMessage(e?.message ?? "Falha inesperada.");
      setIsSubmitting(false);
    }
  }

  const canFinish = step === steps.length - 1;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-xl px-6 py-10">
        <div className="rounded-3xl bg-white p-6 shadow-[0_12px_40px_-24px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/70">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">CADASTRO</div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Cadastro detalhado</h1>
            </div>
            <div className="text-xs font-semibold tabular-nums text-slate-600">{progress}%</div>
          </div>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/70">
            <div className="h-full bg-emerald-600" style={{ width: `${progress}%` }} />
          </div>

          <div className="mt-6">
            <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">
              ETAPA {step + 1} / {steps.length}
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{steps[step]?.title}</div>
          </div>

          <div className="mt-5">
            {step === 0 ? (
              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Nome</span>
                  <input
                    value={state.nome}
                    onChange={(e) => setState((s) => ({ ...s, nome: e.target.value }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                    placeholder="Seu nome"
                    required
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Telefone (WhatsApp)</span>
                  <input
                    value={state.telefone}
                    onChange={(e) => setState((s) => ({ ...s, telefone: e.target.value }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                    placeholder="(11) 9xxxx-xxxx"
                    inputMode="tel"
                    required
                  />
                </label>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">CPF</span>
                  <input
                    value={state.cpf}
                    onChange={(e) => setState((s) => ({ ...s, cpf: e.target.value }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                    required
                  />
                </label>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Endereço</span>
                  <input
                    value={state.endereco}
                    onChange={(e) => setState((s) => ({ ...s, endereco: e.target.value }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                    placeholder="Rua, número, bairro"
                    required
                  />
                </label>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setState((s) => ({ ...s, intent: "comprar" }))}
                  className={
                    "inline-flex h-12 items-center justify-center rounded-2xl px-4 text-sm font-semibold ring-1 transition-all duration-300 " +
                    (state.intent === "comprar"
                      ? "bg-slate-900 text-white ring-slate-900/10"
                      : "bg-white text-slate-800 ring-slate-200/70 hover:bg-slate-50")
                  }
                >
                  Comprar
                </button>
                <button
                  type="button"
                  onClick={() => setState((s) => ({ ...s, intent: "alugar" }))}
                  className={
                    "inline-flex h-12 items-center justify-center rounded-2xl px-4 text-sm font-semibold ring-1 transition-all duration-300 " +
                    (state.intent === "alugar"
                      ? "bg-slate-900 text-white ring-slate-900/10"
                      : "bg-white text-slate-800 ring-slate-200/70 hover:bg-slate-50")
                  }
                >
                  Alugar
                </button>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Bairros (opcional)</span>
                  <input
                    value={state.bairros}
                    onChange={(e) => setState((s) => ({ ...s, bairros: e.target.value }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                    placeholder="Ex: Centro, Jardins"
                  />
                </label>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Valor máximo (opcional)</span>
                    <input
                      value={state.valorMax}
                      onChange={(e) => setState((s) => ({ ...s, valorMax: e.target.value }))}
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                      placeholder="450000"
                      inputMode="numeric"
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Quartos (opcional)</span>
                    <input
                      value={state.quartos}
                      onChange={(e) => setState((s) => ({ ...s, quartos: e.target.value }))}
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                      placeholder="2"
                      inputMode="numeric"
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {step === 5 ? (
              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Crie uma senha</span>
                  <input
                    value={state.senha}
                    onChange={(e) => setState((s) => ({ ...s, senha: e.target.value }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                    placeholder="Mínimo 6 caracteres"
                    type="password"
                    required
                  />
                </label>

                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-600 ring-1 ring-slate-200/70">
                  Sua conta será criada no login com senha. Depois disso, você entra direto no seu dashboard.
                </div>
              </div>
            ) : null}
          </div>

          {errorMessage ? (
            <div className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-200/70">
              {errorMessage}
            </div>
          ) : null}

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={back}
              disabled={step === 0 || isSubmitting}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Voltar
            </button>

            {canFinish ? (
              <button
                type="button"
                onClick={() => void finish()}
                disabled={isSubmitting}
                className="inline-flex h-11 flex-[1.4] items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-[0_10px_24px_-18px_rgba(16,185,129,0.55)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Finalizando..." : "Criar meu acesso"}
              </button>
            ) : (
              <button
                type="button"
                onClick={next}
                disabled={isSubmitting}
                className="inline-flex h-11 flex-[1.4] items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-[0_10px_24px_-18px_rgba(15,23,42,0.55)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Próximo
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
