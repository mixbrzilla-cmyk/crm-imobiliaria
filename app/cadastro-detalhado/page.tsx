"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lock, ShieldCheck, Home } from "lucide-react";

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

function formatCpfBR(input: string) {
  const v = onlyDigits(input).slice(0, 11);
  const p1 = v.slice(0, 3);
  const p2 = v.slice(3, 6);
  const p3 = v.slice(6, 9);
  const p4 = v.slice(9, 11);
  let out = p1;
  if (p2) out += `.${p2}`;
  if (p3) out += `.${p3}`;
  if (p4) out += `-${p4}`;
  return out;
}

function formatPhoneBR(input: string) {
  const d = onlyDigits(input).slice(0, 11);
  const dd = d.slice(0, 2);
  const rest = d.slice(2);
  const isMobile = rest.length >= 9;
  const p1 = isMobile ? rest.slice(0, 5) : rest.slice(0, 4);
  const p2 = isMobile ? rest.slice(5, 9) : rest.slice(4, 8);
  let out = "";
  if (dd) out += `(${dd}`;
  if (dd.length === 2) out += ") ";
  if (p1) out += p1;
  if (p2) out += `-${p2}`;
  return out;
}

function formatCurrencyBRL(input: string) {
  const d = onlyDigits(input);
  if (!d) return "";
  const normalized = d.padStart(3, "0");
  const cents = normalized.slice(-2);
  const ints = normalized.slice(0, -2);
  const intWithSep = ints.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${intWithSep},${cents}`;
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
  const ROYAL_DARK = "#050815";
  const ROYAL_MID = "#07152F";

  const INPUT_BASE_CLASS =
    "h-11 rounded-2xl bg-white px-4 text-sm font-medium text-slate-950 outline-none transition-all duration-200 border border-slate-200";
  const INPUT_BASE_CLASS_WITH_ICON =
    "h-11 w-full rounded-2xl bg-white pl-10 pr-4 text-sm font-medium text-slate-950 outline-none transition-all duration-200 border border-slate-200";

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
      <div className="mt-3 flex items-center justify-center gap-3 text-xs font-semibold text-slate-600">
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
    <div
      className="relative min-h-screen overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(180deg, ${ROYAL_DARK} 0%, ${ROYAL_MID} 55%, ${ROYAL_DARK} 100%)`,
      }}
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <motion.div
          className="absolute -left-24 -top-24 h-[360px] w-[360px] rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle at 30% 30%, ${PRIMARY}66, transparent 62%)` }}
          animate={{
            x: [0, 40, -15, 0],
            y: [0, 18, 44, 0],
            scale: [1, 1.06, 0.98, 1],
          }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -right-24 top-16 h-[420px] w-[420px] rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle at 70% 40%, ${PRIMARY}55, transparent 64%)` }}
          animate={{
            x: [0, -50, 20, 0],
            y: [0, 32, -10, 0],
            scale: [1, 0.98, 1.08, 1],
          }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute left-1/2 top-[55%] h-[380px] w-[380px] -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle at 50% 50%, ${ACCENT}44, transparent 66%)` }}
          animate={{
            x: [0, 24, -28, 0],
            y: [0, -22, 18, 0],
            scale: [1, 1.04, 1, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <motion.div
          className="relative overflow-hidden rounded-[24px] ring-1"
          style={{
            backgroundColor: "rgba(255,255,255,0.92)",
            borderColor: "rgba(15,23,42,0.10)",
            boxShadow: "0 32px 80px -64px rgba(2,6,23,0.95)",
            backdropFilter: "blur(16px)",
          }}
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.65, ease: "easeOut" }}
        >
          <div className="grid grid-cols-1 md:grid-cols-[0.36fr_0.64fr]">
            <div
              className="hidden md:flex flex-col"
              style={{
                background: `linear-gradient(180deg, ${PRIMARY} 0%, #1B2A62 100%)`,
              }}
            >
              <div className="px-10 pt-9">
                <div className="flex items-center gap-3">
                  <div className="relative h-12 w-12 overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/15">
                    <Image
                      src="/imobiliaria-moderna-logo.png"
                      alt="Imobiliária Moderna"
                      fill
                      sizes="48px"
                      className="object-cover"
                      priority
                    />
                  </div>
                  <div className="text-white">
                    <div className="text-xs font-semibold tracking-[0.22em] text-white/80">CADASTRO</div>
                    <div className="mt-1 text-base font-semibold tracking-tight">
                      Imobiliária <span className="font-extrabold">MODERNA</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 px-10">
                <div className="flex h-full flex-col justify-center">
                  <div className="space-y-3">
                    {steps.map((s, idx) => {
                      const isActive = idx === step;
                      const isDone = idx < step;
                      return (
                        <div key={s.key} className="flex items-center gap-3">
                          <div
                            className={
                              "flex h-9 w-9 items-center justify-center rounded-full text-sm font-extrabold transition-all " +
                              (isActive
                                ? "bg-white"
                                : "border border-white/45 bg-white/0 text-white/85")
                            }
                            style={
                              isActive
                                ? {
                                    color: PRIMARY,
                                    boxShadow: "0 0 0 6px rgba(255,255,255,0.10), 0 18px 38px -30px rgba(0,0,0,0.7)",
                                  }
                                : isDone
                                  ? { opacity: 0.95 }
                                  : { opacity: 0.55 }
                            }
                          >
                            {idx + 1}
                          </div>
                          <div className={"text-sm font-semibold " + (isActive ? "text-white" : "text-white/70")}>{s.title}</div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-10">
                    <div className="grid grid-cols-1 gap-2 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15">
                      <div className="flex items-center gap-2 text-xs font-semibold text-white/90">
                        <ShieldCheck className="h-4 w-4" style={{ color: "rgba(255,255,255,0.92)" }} />
                        <span>Segurança: dados criptografados.</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-semibold text-white/90">
                        <Home className="h-4 w-4" style={{ color: "rgba(255,255,255,0.92)" }} />
                        <span>Sonhos: filtros personalizados.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white">
              <div className="md:hidden border-b border-slate-100 px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">PASSO {step + 1} DE {steps.length}</div>
                  <div className="text-xs font-semibold tabular-nums text-slate-600">{progress}%</div>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full"
                    style={{
                      width: `${progress}%`,
                      background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT}B3)`,
                    }}
                  />
                </div>
              </div>

              <div className="px-5 pb-24 pt-6 md:px-10 md:pb-10 md:pt-10">
                <div className="mx-auto flex min-h-[420px] max-w-xl flex-col justify-center">
                  <div className="text-center">
                    <div className="text-xs font-semibold tracking-[0.18em] text-slate-500 md:hidden">CADASTRO</div>
                    <div className="mt-1 text-sm font-semibold" style={{ color: PRIMARY }}>
                      {stepMeta?.title}
                    </div>
                    <h2 className="mt-3 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{stepMeta?.question}</h2>
                    {trustRow}
                  </div>

                  <div className="mt-7">
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
                                className={INPUT_BASE_CLASS}
                                style={{
                                  boxShadow: "0 12px 26px -24px rgba(15,23,42,0.35)",
                                }}
                                onFocus={(e) => {
                                  e.currentTarget.style.borderColor = PRIMARY;
                                  e.currentTarget.style.boxShadow = `0 0 0 3px ${PRIMARY}1F, 0 0 0 1px ${PRIMARY}99, 0 12px 26px -24px rgba(15,23,42,0.35)`;
                                }}
                                onBlur={(e) => {
                                  e.currentTarget.style.borderColor = "rgb(226 232 240)";
                                  e.currentTarget.style.boxShadow = "0 12px 26px -24px rgba(15,23,42,0.35)";
                                }}
                                placeholder="Seu nome"
                                required
                              />
                            </label>

                            <label className="flex flex-col gap-2">
                              <span className="text-xs font-semibold tracking-wide text-slate-700">Telefone (WhatsApp)</span>
                              <input
                                value={state.telefone}
                                onChange={(e) =>
                                  setState((s) => ({
                                    ...s,
                                    telefone: formatPhoneBR(e.target.value),
                                  }))
                                }
                                className={INPUT_BASE_CLASS}
                                style={{
                                  boxShadow: "0 12px 26px -24px rgba(15,23,42,0.35)",
                                }}
                                onFocus={(e) => {
                                  e.currentTarget.style.borderColor = PRIMARY;
                                  e.currentTarget.style.boxShadow = `0 0 0 3px ${PRIMARY}1F, 0 0 0 1px ${PRIMARY}99, 0 12px 26px -24px rgba(15,23,42,0.35)`;
                                }}
                                onBlur={(e) => {
                                  e.currentTarget.style.borderColor = "rgb(226 232 240)";
                                  e.currentTarget.style.boxShadow = "0 12px 26px -24px rgba(15,23,42,0.35)";
                                }}
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
                              <div className="relative">
                                <Lock
                                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                                  style={{ color: ACCENT }}
                                />
                                <input
                                  value={state.cpf}
                                  onChange={(e) =>
                                    setState((s) => ({
                                      ...s,
                                      cpf: formatCpfBR(e.target.value),
                                    }))
                                  }
                                  className={INPUT_BASE_CLASS_WITH_ICON}
                                  style={{
                                    boxShadow: "0 12px 26px -24px rgba(15,23,42,0.35)",
                                  }}
                                  onFocus={(e) => {
                                    e.currentTarget.style.borderColor = PRIMARY;
                                    e.currentTarget.style.boxShadow = `0 0 0 3px ${PRIMARY}1F, 0 0 0 1px ${PRIMARY}99, 0 12px 26px -24px rgba(15,23,42,0.35)`;
                                  }}
                                  onBlur={(e) => {
                                    e.currentTarget.style.borderColor = "rgb(226 232 240)";
                                    e.currentTarget.style.boxShadow = "0 12px 26px -24px rgba(15,23,42,0.35)";
                                  }}
                                  placeholder="000.000.000-00"
                                  inputMode="numeric"
                                  required
                                />
                              </div>
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
                                className={INPUT_BASE_CLASS}
                                style={{
                                  boxShadow: "0 12px 26px -24px rgba(15,23,42,0.35)",
                                }}
                                onFocus={(e) => {
                                  e.currentTarget.style.borderColor = PRIMARY;
                                  e.currentTarget.style.boxShadow = `0 0 0 3px ${PRIMARY}1F, 0 0 0 1px ${PRIMARY}99, 0 12px 26px -24px rgba(15,23,42,0.35)`;
                                }}
                                onBlur={(e) => {
                                  e.currentTarget.style.borderColor = "rgb(226 232 240)";
                                  e.currentTarget.style.boxShadow = "0 12px 26px -24px rgba(15,23,42,0.35)";
                                }}
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
                                      boxShadow: `0 0 0 1px ${PRIMARY}55, 0 0 22px ${PRIMARY}33`,
                                      scale: [1, 1.01, 1],
                                    }
                                  : { boxShadow: "0 0 0 1px rgba(148,163,184,0.35)", scale: 1 }
                              }
                              transition={{ duration: 0.9, repeat: state.intent === "comprar" ? Infinity : 0 }}
                              className={
                                "inline-flex h-14 items-center justify-center rounded-2xl px-4 text-sm font-semibold ring-1 transition-all duration-200 " +
                                (state.intent === "comprar"
                                  ? "text-white"
                                  : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50")
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
                                      boxShadow: `0 0 0 1px ${PRIMARY}55, 0 0 22px ${PRIMARY}33`,
                                      scale: [1, 1.01, 1],
                                    }
                                  : { boxShadow: "0 0 0 1px rgba(148,163,184,0.35)", scale: 1 }
                              }
                              transition={{ duration: 0.9, repeat: state.intent === "alugar" ? Infinity : 0 }}
                              className={
                                "inline-flex h-14 items-center justify-center rounded-2xl px-4 text-sm font-semibold ring-1 transition-all duration-200 " +
                                (state.intent === "alugar"
                                  ? "text-white"
                                  : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50")
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
                                className={INPUT_BASE_CLASS}
                                style={{
                                  boxShadow: "0 12px 26px -24px rgba(15,23,42,0.35)",
                                }}
                                onFocus={(e) => {
                                  e.currentTarget.style.borderColor = PRIMARY;
                                  e.currentTarget.style.boxShadow = `0 0 0 3px ${PRIMARY}1F, 0 0 0 1px ${PRIMARY}99, 0 12px 26px -24px rgba(15,23,42,0.35)`;
                                }}
                                onBlur={(e) => {
                                  e.currentTarget.style.borderColor = "rgb(226 232 240)";
                                  e.currentTarget.style.boxShadow = "0 12px 26px -24px rgba(15,23,42,0.35)";
                                }}
                                placeholder="Ex: Centro, Jardins"
                              />
                            </label>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <label className="flex flex-col gap-2">
                                <span className="text-xs font-semibold tracking-wide text-slate-700">Valor máximo (opcional)</span>
                                <input
                                  value={state.valorMax}
                                  onChange={(e) =>
                                    setState((s) => ({
                                      ...s,
                                      valorMax: formatCurrencyBRL(e.target.value),
                                    }))
                                  }
                                  className={INPUT_BASE_CLASS}
                                  style={{
                                    boxShadow: "0 12px 26px -24px rgba(15,23,42,0.35)",
                                  }}
                                  onFocus={(e) => {
                                    e.currentTarget.style.borderColor = PRIMARY;
                                    e.currentTarget.style.boxShadow = `0 0 0 3px ${PRIMARY}1F, 0 0 0 1px ${PRIMARY}99, 0 12px 26px -24px rgba(15,23,42,0.35)`;
                                  }}
                                  onBlur={(e) => {
                                    e.currentTarget.style.borderColor = "rgb(226 232 240)";
                                    e.currentTarget.style.boxShadow = "0 12px 26px -24px rgba(15,23,42,0.35)";
                                  }}
                                  placeholder="450000"
                                  inputMode="numeric"
                                />
                              </label>

                              <label className="flex flex-col gap-2">
                                <span className="text-xs font-semibold tracking-wide text-slate-700">Quartos (opcional)</span>
                                <input
                                  value={state.quartos}
                                  onChange={(e) => setState((s) => ({ ...s, quartos: e.target.value }))}
                                  className={INPUT_BASE_CLASS}
                                  style={{
                                    boxShadow: "0 12px 26px -24px rgba(15,23,42,0.35)",
                                  }}
                                  onFocus={(e) => {
                                    e.currentTarget.style.borderColor = PRIMARY;
                                    e.currentTarget.style.boxShadow = `0 0 0 3px ${PRIMARY}1F, 0 0 0 1px ${PRIMARY}99, 0 12px 26px -24px rgba(15,23,42,0.35)`;
                                  }}
                                  onBlur={(e) => {
                                    e.currentTarget.style.borderColor = "rgb(226 232 240)";
                                    e.currentTarget.style.boxShadow = "0 12px 26px -24px rgba(15,23,42,0.35)";
                                  }}
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
                              <div className="relative">
                                <Lock
                                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                                  style={{ color: ACCENT }}
                                />
                                <input
                                  value={state.senha}
                                  onChange={(e) => setState((s) => ({ ...s, senha: e.target.value }))}
                                  className={INPUT_BASE_CLASS_WITH_ICON}
                                  style={{
                                    boxShadow: "0 12px 26px -24px rgba(15,23,42,0.35)",
                                  }}
                                  onFocus={(e) => {
                                    e.currentTarget.style.borderColor = PRIMARY;
                                    e.currentTarget.style.boxShadow = `0 0 0 3px ${PRIMARY}1F, 0 0 0 1px ${PRIMARY}99, 0 12px 26px -24px rgba(15,23,42,0.35)`;
                                  }}
                                  onBlur={(e) => {
                                    e.currentTarget.style.borderColor = "rgb(226 232 240)";
                                    e.currentTarget.style.boxShadow = "0 12px 26px -24px rgba(15,23,42,0.35)";
                                  }}
                                  placeholder="Mínimo 6 caracteres"
                                  type="password"
                                  required
                                />
                              </div>
                            </label>

                            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                              Sua conta é criada com segurança e você entra direto no seu portal.
                            </div>
                          </div>
                        ) : null}
                      </motion.div>
                    </AnimatePresence>

                    {errorMessage ? (
                      <div className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-200/70">
                        {errorMessage}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
                <div className="mx-auto flex w-full max-w-xl items-center gap-3">
                  <button
                    type="button"
                    onClick={back}
                    disabled={step === 0 || isSubmitting}
                    className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Voltar
                  </button>

                  {canFinish ? (
                    <button
                      type="button"
                      onClick={() => void finish()}
                      disabled={isSubmitting}
                      className="inline-flex h-11 flex-[1.4] items-center justify-center rounded-xl px-5 text-sm font-semibold text-white shadow-[0_14px_34px_-26px_rgba(47,59,119,0.55)] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ backgroundColor: PRIMARY }}
                    >
                      {isSubmitting ? "Finalizando..." : "Criar meu acesso"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={next}
                      disabled={isSubmitting}
                      className="inline-flex h-11 flex-[1.4] items-center justify-center rounded-xl px-5 text-sm font-semibold text-white shadow-[0_14px_34px_-26px_rgba(47,59,119,0.55)] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ backgroundColor: PRIMARY }}
                    >
                      Próximo
                    </button>
                  )}
                </div>
              </div>

              <div className="hidden md:block px-10 pb-10">
                <div className="mx-auto flex w-full max-w-xl items-center gap-3">
                  <button
                    type="button"
                    onClick={back}
                    disabled={step === 0 || isSubmitting}
                    className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition-all duration-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Voltar
                  </button>

                  {canFinish ? (
                    <button
                      type="button"
                      onClick={() => void finish()}
                      disabled={isSubmitting}
                      className="inline-flex h-11 flex-[1.4] items-center justify-center rounded-xl px-5 text-sm font-semibold text-white shadow-[0_14px_34px_-26px_rgba(47,59,119,0.55)] transition-all duration-200 hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ backgroundColor: PRIMARY }}
                    >
                      {isSubmitting ? "Finalizando..." : "Criar meu acesso"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={next}
                      disabled={isSubmitting}
                      className="inline-flex h-11 flex-[1.4] items-center justify-center rounded-xl px-5 text-sm font-semibold text-white shadow-[0_14px_34px_-26px_rgba(47,59,119,0.55)] transition-all duration-200 hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ backgroundColor: PRIMARY }}
                    >
                      Próximo
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
