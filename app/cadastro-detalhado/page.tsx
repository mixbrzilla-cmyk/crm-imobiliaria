"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lock, ShieldCheck } from "lucide-react";

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

  const PRIMARY = "#2F3B77";
  const ACCENT = "#C1121F";
  const SOFT_BG = "#F4F7FA";

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
      {
        key: "contato",
        title: "Primeiro passo",
        question: "Como devemos te chamar nesta nova jornada?",
        micro: "Falta pouco para o seu café na varanda nova.",
      },
      {
        key: "cpf",
        title: "Segurança",
        question: "Segurança em primeiro lugar. Seu CPF garante uma negociação transparente.",
        micro: "Ambiente validado para reduzir fraudes e acelerar propostas.",
      },
      {
        key: "endereco",
        title: "Localização",
        question: "Onde a sua história continua?",
        micro: "Ajustando o raio de busca com base no seu endereço.",
      },
      {
        key: "intent",
        title: "Objetivo",
        question: "Agora é hora de decidir: comprar ou alugar?",
        micro: "Analisando 1.200 imóveis para você agora...",
      },
      {
        key: "prefs",
        title: "Preferências",
        question: "Escolha os bairros dos seus sonhos.",
        micro: "Seu perfil está ficando muito preciso — isso aumenta suas chances.",
      },
      {
        key: "senha",
        title: "Portal exclusivo",
        question: "Defina sua chave de acesso ao seu novo portal exclusivo.",
        micro: "Seu painel vai te mostrar sugestões em tempo real.",
      },
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

  const stepMeta = steps[step];

  const trustRow = useMemo(() => {
    const show = stepMeta?.key === "cpf" || stepMeta?.key === "senha";
    if (!show) return null;

    return (
      <div className="mt-3 flex items-center gap-3 text-xs font-semibold text-slate-600">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/60 px-3 py-1.5 ring-1 ring-white/50 backdrop-blur">
          <ShieldCheck className="h-4 w-4" style={{ color: PRIMARY }} />
          <span>Escudo Digital</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-white/60 px-3 py-1.5 ring-1 ring-white/50 backdrop-blur">
          <Lock className="h-4 w-4" style={{ color: PRIMARY }} />
          <span>Cadeado SSL</span>
        </div>
      </div>
    );
  }, [PRIMARY, stepMeta?.key]);

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ backgroundColor: SOFT_BG }}>
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <motion.div
          className="absolute -left-24 -top-24 h-[360px] w-[360px] rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle at 30% 30%, ${PRIMARY}22, transparent 62%)` }}
          animate={{
            x: [0, 40, -15, 0],
            y: [0, 18, 44, 0],
            scale: [1, 1.06, 0.98, 1],
          }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -right-24 top-16 h-[420px] w-[420px] rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle at 70% 40%, ${PRIMARY}18, transparent 64%)` }}
          animate={{
            x: [0, -50, 20, 0],
            y: [0, 32, -10, 0],
            scale: [1, 0.98, 1.08, 1],
          }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute left-1/2 top-[55%] h-[380px] w-[380px] -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle at 50% 50%, ${ACCENT}18, transparent 66%)` }}
          animate={{
            x: [0, 24, -28, 0],
            y: [0, -22, 18, 0],
            scale: [1, 1.04, 1, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      <div className="mx-auto w-full max-w-xl px-6 py-10">
        <motion.div
          className="rounded-3xl p-6 ring-1"
          style={{
            backgroundColor: "rgba(255,255,255,0.62)",
            borderColor: "rgba(255,255,255,0.55)",
            boxShadow: "0 22px 70px -52px rgba(15,23,42,0.65)",
            backdropFilter: "blur(14px)",
          }}
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.65, ease: "easeOut" }}
        >
          <div className="flex items-center justify-center">
            <div className="relative h-16 w-16 overflow-hidden rounded-full ring-2 ring-white/70 shadow-[0_18px_40px_-28px_rgba(47,59,119,0.65)]">
              <Image
                src="/imobiliaria-moderna-logo.png"
                alt="Imobiliária Moderna"
                fill
                sizes="64px"
                className="object-cover"
                priority
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="mt-4 text-xs font-semibold tracking-[0.18em] text-slate-500">CADASTRO</div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                Imobiliária <span className="font-extrabold" style={{ color: PRIMARY }}>
                  MODERNA
                </span>
              </h1>
              <div className="mt-1 text-sm text-slate-600">Experiência de descoberta imobiliária</div>
            </div>
            <div className="text-xs font-semibold tabular-nums text-slate-600">{progress}%</div>
          </div>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/40 ring-1 ring-white/55 backdrop-blur">
            <div
              className="h-full"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT}B3)`,
                boxShadow: `0 0 18px ${ACCENT}66`,
              }}
            />
          </div>

          <div className="mt-6">
            <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">
              ETAPA {step + 1} / {steps.length}
            </div>
            <div className="mt-2 text-lg font-semibold" style={{ color: PRIMARY }}>
              {stepMeta?.title}
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{stepMeta?.question}</div>
            {trustRow}
          </div>

          <div className="mt-5">
            <div className="grid grid-cols-1 gap-4">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={String(stepMeta?.key)}
                  initial={{ opacity: 0, x: 22 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -22 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="flex flex-col gap-4"
                >
                  {step === 0 ? (
                    <div className="flex flex-col gap-4">
                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold tracking-wide text-slate-700">Nome</span>
                        <input
                          value={state.nome}
                          onChange={(e) => setState((s) => ({ ...s, nome: e.target.value }))}
                          className="h-11 rounded-2xl bg-white/70 px-4 text-sm text-slate-900 ring-1 ring-white/60 outline-none transition-all duration-300 focus:ring-2"
                          style={{ boxShadow: "0 16px 34px -30px rgba(15,23,42,0.55)", borderColor: "rgba(255,255,255,0.7)" }}
                          placeholder="Seu nome"
                          required
                        />
                      </label>

                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold tracking-wide text-slate-700">Telefone (WhatsApp)</span>
                        <input
                          value={state.telefone}
                          onChange={(e) => setState((s) => ({ ...s, telefone: e.target.value }))}
                          className="h-11 rounded-2xl bg-white/70 px-4 text-sm text-slate-900 ring-1 ring-white/60 outline-none transition-all duration-300 focus:ring-2"
                          style={{ boxShadow: "0 16px 34px -30px rgba(15,23,42,0.55)", borderColor: "rgba(255,255,255,0.7)" }}
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
                        <span className="text-xs font-semibold tracking-wide text-slate-700">CPF</span>
                        <input
                          value={state.cpf}
                          onChange={(e) => setState((s) => ({ ...s, cpf: e.target.value }))}
                          className="h-11 rounded-2xl bg-white/70 px-4 text-sm text-slate-900 ring-1 ring-white/60 outline-none transition-all duration-300 focus:ring-2"
                          style={{ boxShadow: "0 16px 34px -30px rgba(15,23,42,0.55)", borderColor: "rgba(255,255,255,0.7)" }}
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
                        <span className="text-xs font-semibold tracking-wide text-slate-700">Endereço</span>
                        <input
                          value={state.endereco}
                          onChange={(e) => setState((s) => ({ ...s, endereco: e.target.value }))}
                          className="h-11 rounded-2xl bg-white/70 px-4 text-sm text-slate-900 ring-1 ring-white/60 outline-none transition-all duration-300 focus:ring-2"
                          style={{ boxShadow: "0 16px 34px -30px rgba(15,23,42,0.55)", borderColor: "rgba(255,255,255,0.7)" }}
                          placeholder="Rua, número, bairro"
                          required
                        />
                      </label>
                    </div>
                  ) : null}

                  {step === 3 ? (
                    <div className="grid grid-cols-2 gap-3">
                      <motion.button
                        type="button"
                        onClick={() => setState((s) => ({ ...s, intent: "comprar" }))}
                        animate={
                          state.intent === "comprar"
                            ? {
                                boxShadow: `0 0 0 1px ${PRIMARY}55, 0 0 22px ${PRIMARY}55, 0 0 26px ${ACCENT}22`,
                                scale: [1, 1.02, 1],
                              }
                            : { boxShadow: "0 0 0 1px rgba(255,255,255,0.55)", scale: 1 }
                        }
                        transition={{ duration: 0.9, repeat: state.intent === "comprar" ? Infinity : 0 }}
                        className={
                          "inline-flex h-14 items-center justify-center rounded-2xl px-4 text-sm font-semibold ring-1 transition-all duration-300 " +
                          (state.intent === "comprar"
                            ? "text-white"
                            : "bg-white/65 text-slate-800 ring-white/55 hover:bg-white/75")
                        }
                        style={state.intent === "comprar" ? { backgroundColor: PRIMARY, borderColor: PRIMARY } : undefined}
                      >
                        Comprar
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={() => setState((s) => ({ ...s, intent: "alugar" }))}
                        animate={
                          state.intent === "alugar"
                            ? {
                                boxShadow: `0 0 0 1px ${PRIMARY}55, 0 0 22px ${PRIMARY}55, 0 0 26px ${ACCENT}22`,
                                scale: [1, 1.02, 1],
                              }
                            : { boxShadow: "0 0 0 1px rgba(255,255,255,0.55)", scale: 1 }
                        }
                        transition={{ duration: 0.9, repeat: state.intent === "alugar" ? Infinity : 0 }}
                        className={
                          "inline-flex h-14 items-center justify-center rounded-2xl px-4 text-sm font-semibold ring-1 transition-all duration-300 " +
                          (state.intent === "alugar"
                            ? "text-white"
                            : "bg-white/65 text-slate-800 ring-white/55 hover:bg-white/75")
                        }
                        style={state.intent === "alugar" ? { backgroundColor: PRIMARY, borderColor: PRIMARY } : undefined}
                      >
                        Alugar
                      </motion.button>
                    </div>
                  ) : null}

                  {step === 4 ? (
                    <div className="flex flex-col gap-4">
                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold tracking-wide text-slate-700">Bairros (opcional)</span>
                        <input
                          value={state.bairros}
                          onChange={(e) => setState((s) => ({ ...s, bairros: e.target.value }))}
                          className="h-11 rounded-2xl bg-white/70 px-4 text-sm text-slate-900 ring-1 ring-white/60 outline-none transition-all duration-300 focus:ring-2"
                          style={{ boxShadow: "0 16px 34px -30px rgba(15,23,42,0.55)", borderColor: "rgba(255,255,255,0.7)" }}
                          placeholder="Ex: Centro, Jardins"
                        />
                      </label>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <label className="flex flex-col gap-2">
                          <span className="text-xs font-semibold tracking-wide text-slate-700">Valor máximo (opcional)</span>
                          <input
                            value={state.valorMax}
                            onChange={(e) => setState((s) => ({ ...s, valorMax: e.target.value }))}
                            className="h-11 rounded-2xl bg-white/70 px-4 text-sm text-slate-900 ring-1 ring-white/60 outline-none transition-all duration-300 focus:ring-2"
                            style={{ boxShadow: "0 16px 34px -30px rgba(15,23,42,0.55)", borderColor: "rgba(255,255,255,0.7)" }}
                            placeholder="450000"
                            inputMode="numeric"
                          />
                        </label>

                        <label className="flex flex-col gap-2">
                          <span className="text-xs font-semibold tracking-wide text-slate-700">Quartos (opcional)</span>
                          <input
                            value={state.quartos}
                            onChange={(e) => setState((s) => ({ ...s, quartos: e.target.value }))}
                            className="h-11 rounded-2xl bg-white/70 px-4 text-sm text-slate-900 ring-1 ring-white/60 outline-none transition-all duration-300 focus:ring-2"
                            style={{ boxShadow: "0 16px 34px -30px rgba(15,23,42,0.55)", borderColor: "rgba(255,255,255,0.7)" }}
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
                        <span className="text-xs font-semibold tracking-wide text-slate-700">Senha</span>
                        <input
                          value={state.senha}
                          onChange={(e) => setState((s) => ({ ...s, senha: e.target.value }))}
                          className="h-11 rounded-2xl bg-white/70 px-4 text-sm text-slate-900 ring-1 ring-white/60 outline-none transition-all duration-300 focus:ring-2"
                          style={{ boxShadow: "0 16px 34px -30px rgba(15,23,42,0.55)", borderColor: "rgba(255,255,255,0.7)" }}
                          placeholder="Mínimo 6 caracteres"
                          type="password"
                          required
                        />
                      </label>

                      <div className="rounded-2xl bg-white/55 px-4 py-3 text-xs font-semibold text-slate-700 ring-1 ring-white/55 backdrop-blur">
                        Sua conta é criada com segurança e você entra direto no seu portal.
                      </div>
                    </div>
                  ) : null}
                </motion.div>
              </AnimatePresence>

              <div className="rounded-2xl bg-white/55 px-4 py-3 text-sm font-semibold text-slate-800 ring-1 ring-white/55 backdrop-blur">
                {stepMeta?.micro}
              </div>

              <div className="text-center text-[11px] font-semibold tracking-wide text-slate-600">
                Ambiente Criptografado - Protocolo de Segurança Imobiliária Moderna
              </div>
            </div>
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
                className="inline-flex h-11 flex-[1.4] items-center justify-center rounded-xl px-5 text-sm font-semibold text-white shadow-[0_10px_24px_-18px_rgba(47,59,119,0.45)] transition-all duration-300 hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: PRIMARY }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = ACCENT;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = PRIMARY;
                }}
              >
                {isSubmitting ? "Finalizando..." : "Criar meu acesso"}
              </button>
            ) : (
              <button
                type="button"
                onClick={next}
                disabled={isSubmitting}
                className="inline-flex h-11 flex-[1.4] items-center justify-center rounded-xl px-5 text-sm font-semibold text-white shadow-[0_10px_24px_-18px_rgba(47,59,119,0.45)] transition-all duration-300 hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: PRIMARY }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = ACCENT;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = PRIMARY;
                }}
              >
                Próximo
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
