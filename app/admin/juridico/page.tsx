"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AlertTriangle,
  Briefcase,
  FileText,
  Gavel,
  Link as LinkIcon,
  Plus,
  RefreshCw,
  Scale,
  User,
} from "lucide-react";

import { getSupabaseClient } from "@/lib/supabaseClient";

type CaseStatus = "aberto" | "em_andamento" | "concluido" | "suspenso";

type LawyerRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  oab: string | null;
  meeting_link: string | null;
  created_at?: string;
};

type CaseRow = {
  id: string;
  title: string;
  client_name: string | null;
  status: CaseStatus;
  due_date: string | null;
  lawyer_id: string | null;
  meeting_link: string | null;
  notes: string | null;
  created_at?: string;
};

type DocumentType = "certidao" | "contrato" | "outro";

type DocumentRow = {
  id: string;
  case_id: string | null;
  title: string;
  doc_type: DocumentType;
  url: string;
  created_at?: string;
};

type LawyerForm = {
  full_name: string;
  email: string;
  phone: string;
  oab: string;
  meeting_link: string;
};

type CaseForm = {
  title: string;
  client_name: string;
  status: CaseStatus;
  due_date: string;
  lawyer_id: string;
  meeting_link: string;
  notes: string;
};

type DocumentForm = {
  case_id: string;
  title: string;
  doc_type: DocumentType;
  url: string;
};

function daysUntil(dateISO: string) {
  const d = new Date(dateISO);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const ms = target.getTime() - start.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function deadlineBadge(due_date: string | null) {
  if (!due_date) return null;
  const diff = daysUntil(due_date);
  if (diff < 0) {
    return {
      label: "Vencido",
      cls: "bg-red-50 text-red-700 ring-1 ring-red-200/70",
      icon: AlertTriangle,
    };
  }
  if (diff <= 7) {
    return {
      label: `Vence em ${diff}d`,
      cls: "bg-red-50 text-red-700 ring-1 ring-red-200/70",
      icon: AlertTriangle,
    };
  }
  return {
    label: `Em ${diff}d`,
    cls: "bg-slate-100 text-slate-700 ring-1 ring-slate-200/70",
    icon: null,
  };
}

export default function JuridicoAdminPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [tab, setTab] = useState<"processos" | "advogados" | "documentos">("processos");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [lawyers, setLawyers] = useState<LawyerRow[]>([]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [docs, setDocs] = useState<DocumentRow[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [lawyerForm, setLawyerForm] = useState<LawyerForm>({
    full_name: "",
    email: "",
    phone: "",
    oab: "",
    meeting_link: "",
  });

  const [caseForm, setCaseForm] = useState<CaseForm>({
    title: "",
    client_name: "",
    status: "aberto",
    due_date: "",
    lawyer_id: "",
    meeting_link: "",
    notes: "",
  });

  const [docForm, setDocForm] = useState<DocumentForm>({
    case_id: "",
    title: "",
    doc_type: "certidao",
    url: "",
  });

  const loadAll = useCallback(async () => {
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      setLawyers([]);
      setCases([]);
      setDocs([]);
      return;
    }

    setIsLoading(true);

    try {
      const [lawRes, caseRes, docRes] = await Promise.allSettled([
        (supabase as any)
          .from("legal_lawyers")
          .select("id, full_name, email, phone, oab, meeting_link, created_at")
          .order("full_name", { ascending: true }),
        (supabase as any)
          .from("legal_cases")
          .select("id, title, client_name, status, due_date, lawyer_id, meeting_link, notes, created_at")
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("legal_documents")
          .select("id, case_id, title, doc_type, url, created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (lawRes.status === "fulfilled") {
        if (lawRes.value.error) {
          setErrorMessage(lawRes.value.error.message);
          setLawyers([]);
        } else {
          setLawyers((lawRes.value.data ?? []) as LawyerRow[]);
        }
      }

      if (caseRes.status === "fulfilled") {
        if (caseRes.value.error) {
          setErrorMessage(caseRes.value.error.message);
          setCases([]);
        } else {
          setCases((caseRes.value.data ?? []) as CaseRow[]);
        }
      }

      if (docRes.status === "fulfilled") {
        if (docRes.value.error) {
          setErrorMessage(docRes.value.error.message);
          setDocs([]);
        } else {
          setDocs((docRes.value.data ?? []) as DocumentRow[]);
        }
      }
    } catch {
      setErrorMessage("Não foi possível carregar o módulo jurídico agora.");
      setLawyers([]);
      setCases([]);
      setDocs([]);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function addLawyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        id: crypto.randomUUID(),
        full_name: lawyerForm.full_name.trim(),
        email: lawyerForm.email.trim() || null,
        phone: lawyerForm.phone.trim() || null,
        oab: lawyerForm.oab.trim() || null,
        meeting_link: lawyerForm.meeting_link.trim() || null,
      };

      const { error } = await (supabase as any).from("legal_lawyers").insert(payload);
      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setLawyerForm({ full_name: "", email: "", phone: "", oab: "", meeting_link: "" });
      await loadAll();
    } catch {
      setErrorMessage("Não foi possível salvar o advogado.");
    } finally {
      setIsSaving(false);
    }
  }

  async function addCase(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        id: crypto.randomUUID(),
        title: caseForm.title.trim(),
        client_name: caseForm.client_name.trim() || null,
        status: caseForm.status,
        due_date: caseForm.due_date.trim() || null,
        lawyer_id: caseForm.lawyer_id.trim() || null,
        meeting_link: caseForm.meeting_link.trim() || null,
        notes: caseForm.notes.trim() || null,
      };

      const { error } = await (supabase as any).from("legal_cases").insert(payload);
      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setCaseForm({
        title: "",
        client_name: "",
        status: "aberto",
        due_date: "",
        lawyer_id: "",
        meeting_link: "",
        notes: "",
      });

      await loadAll();
    } catch {
      setErrorMessage("Não foi possível salvar o processo.");
    } finally {
      setIsSaving(false);
    }
  }

  async function addDocument(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        id: crypto.randomUUID(),
        case_id: docForm.case_id.trim() || null,
        title: docForm.title.trim(),
        doc_type: docForm.doc_type,
        url: docForm.url.trim(),
      };

      const { error } = await (supabase as any).from("legal_documents").insert(payload);
      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setDocForm({ case_id: "", title: "", doc_type: "certidao", url: "" });
      await loadAll();
    } catch {
      setErrorMessage("Não foi possível salvar o documento.");
    } finally {
      setIsSaving(false);
    }
  }

  const lawyerById = useMemo(() => {
    const map = new Map<string, LawyerRow>();
    for (const l of lawyers) map.set(l.id, l);
    return map;
  }, [lawyers]);

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">
          JURÍDICO • PROCESSOS • DOCUMENTOS
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Jurídico</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          Gestão de processos, advogados e repositório de documentos. Alertas em vermelho para prazos vencendo.
        </p>
      </header>

      {errorMessage ? (
        <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200/70">
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-2xl bg-white p-3 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200/70">
          <button
            type="button"
            onClick={() => setTab("processos")}
            className={
              "flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-300 " +
              (tab === "processos"
                ? "bg-white text-slate-900 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70"
                : "text-slate-600 hover:bg-white/70")
            }
          >
            <Briefcase className="h-4 w-4" />
            Processos
          </button>
          <button
            type="button"
            onClick={() => setTab("advogados")}
            className={
              "flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-300 " +
              (tab === "advogados"
                ? "bg-white text-slate-900 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70"
                : "text-slate-600 hover:bg-white/70")
            }
          >
            <Scale className="h-4 w-4" />
            Advogados
          </button>
          <button
            type="button"
            onClick={() => setTab("documentos")}
            className={
              "flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-300 " +
              (tab === "documentos"
                ? "bg-white text-slate-900 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70"
                : "text-slate-600 hover:bg-white/70")
            }
          >
            <FileText className="h-4 w-4" />
            Documentos
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          {tab === "advogados" ? (
            <div className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Novo advogado</div>
                  <div className="mt-1 text-xs text-slate-500">Cadastro + link de vídeo-chamada.</div>
                </div>
                <Gavel className="h-4 w-4 text-slate-400" />
              </div>

              <form onSubmit={addLawyer} className="mt-5 flex flex-col gap-4">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Nome</span>
                  <input
                    value={lawyerForm.full_name}
                    onChange={(e) => setLawyerForm((s) => ({ ...s, full_name: e.target.value }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                    placeholder="Nome completo"
                    required
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Email</span>
                    <input
                      value={lawyerForm.email}
                      onChange={(e) => setLawyerForm((s) => ({ ...s, email: e.target.value }))}
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                      placeholder="email@"
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Telefone</span>
                    <input
                      value={lawyerForm.phone}
                      onChange={(e) => setLawyerForm((s) => ({ ...s, phone: e.target.value }))}
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                      placeholder="(DDD) ..."
                    />
                  </label>
                </div>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">OAB (opcional)</span>
                  <input
                    value={lawyerForm.oab}
                    onChange={(e) => setLawyerForm((s) => ({ ...s, oab: e.target.value }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                    placeholder="UF 123456"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Link de vídeo-chamada</span>
                  <div className="relative">
                    <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={lawyerForm.meeting_link}
                      onChange={(e) => setLawyerForm((s) => ({ ...s, meeting_link: e.target.value }))}
                      className="h-11 w-full rounded-xl bg-white pl-10 pr-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                      placeholder="https://meet..."
                    />
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#ff0000] px-5 text-sm font-semibold text-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.20)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#e60000] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  {isSaving ? "Salvando..." : "Adicionar"}
                </button>
              </form>
            </div>
          ) : tab === "documentos" ? (
            <div className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Novo documento</div>
                  <div className="mt-1 text-xs text-slate-500">Certidões / contratos / links.</div>
                </div>
                <FileText className="h-4 w-4 text-slate-400" />
              </div>

              <form onSubmit={addDocument} className="mt-5 flex flex-col gap-4">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Processo (opcional)</span>
                  <select
                    value={docForm.case_id}
                    onChange={(e) => setDocForm((s) => ({ ...s, case_id: e.target.value }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                  >
                    <option value="">Sem vínculo</option>
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Título</span>
                  <input
                    value={docForm.title}
                    onChange={(e) => setDocForm((s) => ({ ...s, title: e.target.value }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                    placeholder="Contrato de compra e venda"
                    required
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Tipo</span>
                  <select
                    value={docForm.doc_type}
                    onChange={(e) => setDocForm((s) => ({ ...s, doc_type: e.target.value as DocumentType }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                  >
                    <option value="certidao">Certidão</option>
                    <option value="contrato">Contrato</option>
                    <option value="outro">Outro</option>
                  </select>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">URL</span>
                  <div className="relative">
                    <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={docForm.url}
                      onChange={(e) => setDocForm((s) => ({ ...s, url: e.target.value }))}
                      className="h-11 w-full rounded-xl bg-white pl-10 pr-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                      placeholder="https://drive..."
                      required
                    />
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#001f3f] px-5 text-sm font-semibold text-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.20)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#001a33] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  {isSaving ? "Salvando..." : "Adicionar"}
                </button>
              </form>
            </div>
          ) : (
            <div className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Novo processo</div>
                  <div className="mt-1 text-xs text-slate-500">Prazo + advogado + link de vídeo.</div>
                </div>
                <button
                  type="button"
                  onClick={() => void loadAll()}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  Atualizar
                </button>
              </div>

              <form onSubmit={addCase} className="mt-5 flex flex-col gap-4">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Título</span>
                  <input
                    value={caseForm.title}
                    onChange={(e) => setCaseForm((s) => ({ ...s, title: e.target.value }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                    placeholder="Ex: Regularização / Usucapião / Contrato"
                    required
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Cliente (opcional)</span>
                  <input
                    value={caseForm.client_name}
                    onChange={(e) => setCaseForm((s) => ({ ...s, client_name: e.target.value }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                    placeholder="Nome"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Status</span>
                    <select
                      value={caseForm.status}
                      onChange={(e) => setCaseForm((s) => ({ ...s, status: e.target.value as CaseStatus }))}
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                    >
                      <option value="aberto">Aberto</option>
                      <option value="em_andamento">Em andamento</option>
                      <option value="concluido">Concluído</option>
                      <option value="suspenso">Suspenso</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Prazo (opcional)</span>
                    <input
                      type="date"
                      value={caseForm.due_date}
                      onChange={(e) => setCaseForm((s) => ({ ...s, due_date: e.target.value }))}
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                    />
                  </label>
                </div>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Advogado (opcional)</span>
                  <select
                    value={caseForm.lawyer_id}
                    onChange={(e) => setCaseForm((s) => ({ ...s, lawyer_id: e.target.value }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                  >
                    <option value="">Sem advogado</option>
                    {lawyers.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.full_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Link de vídeo-chamada</span>
                  <div className="relative">
                    <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={caseForm.meeting_link}
                      onChange={(e) => setCaseForm((s) => ({ ...s, meeting_link: e.target.value }))}
                      className="h-11 w-full rounded-xl bg-white pl-10 pr-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                      placeholder="https://meet..."
                    />
                  </div>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Observações</span>
                  <input
                    value={caseForm.notes}
                    onChange={(e) => setCaseForm((s) => ({ ...s, notes: e.target.value }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                    placeholder="Notas rápidas"
                  />
                </label>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#ff0000] px-5 text-sm font-semibold text-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.20)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#e60000] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  {isSaving ? "Salvando..." : "Adicionar"}
                </button>
              </form>
            </div>
          )}
        </div>

        <div className="lg:col-span-8">
          <div className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {tab === "advogados" ? "Advogados" : tab === "documentos" ? "Repositório" : "Processos"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {tab === "processos"
                    ? "Prazos e alertas (vermelho)."
                    : tab === "advogados"
                      ? "Cadastro de responsáveis jurídicos."
                      : "Links de certidões/contratos."}
                </div>
              </div>
              <div className="text-xs text-slate-500">
                {isLoading
                  ? "Atualizando..."
                  : tab === "advogados"
                    ? `${lawyers.length} itens`
                    : tab === "documentos"
                      ? `${docs.length} itens`
                      : `${cases.length} itens`}
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3">
              {tab === "advogados" ? (
                lawyers.length > 0 ? (
                  lawyers.map((l) => (
                    <div
                      key={l.id}
                      className="rounded-2xl bg-slate-50 px-5 py-4 ring-1 ring-slate-200/70"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">{l.full_name}</div>
                          <div className="mt-1 text-xs text-slate-600">{l.oab ?? "-"}</div>
                        </div>
                        {l.meeting_link ? (
                          <a
                            href={l.meeting_link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[#001f3f] px-3 text-xs font-semibold text-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.20)] transition-all duration-300 hover:bg-[#001a33]"
                          >
                            <LinkIcon className="h-4 w-4" />
                            Chamada
                          </a>
                        ) : null}
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-slate-400" />
                          {l.email ?? "-"}
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-slate-400" />
                          {l.phone ?? "-"}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl bg-slate-50 px-5 py-6 text-sm text-slate-600 ring-1 ring-slate-200/70">
                    Nenhum advogado cadastrado.
                  </div>
                )
              ) : tab === "documentos" ? (
                docs.length > 0 ? (
                  docs.map((d) => (
                    <div
                      key={d.id}
                      className="rounded-2xl bg-slate-50 px-5 py-4 ring-1 ring-slate-200/70"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">{d.title}</div>
                          <div className="mt-1 text-xs text-slate-600">
                            Tipo: {d.doc_type} • Processo: {d.case_id ? (cases.find((c) => c.id === d.case_id)?.title ?? d.case_id) : "-"}
                          </div>
                        </div>
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-white px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-100"
                        >
                          <FileText className="h-4 w-4" />
                          Abrir
                        </a>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl bg-slate-50 px-5 py-6 text-sm text-slate-600 ring-1 ring-slate-200/70">
                    Nenhum documento cadastrado.
                  </div>
                )
              ) : cases.length > 0 ? (
                cases.map((c) => {
                  const badge = deadlineBadge(c.due_date);
                  const lawyer = c.lawyer_id ? lawyerById.get(c.lawyer_id) : null;
                  const BadgeIcon = badge?.icon ?? null;
                  return (
                    <div
                      key={c.id}
                      className={
                        "rounded-2xl px-5 py-4 ring-1 " +
                        (badge && (badge.label === "Vencido" || badge.label.startsWith("Vence"))
                          ? "bg-red-50/60 ring-red-200/70"
                          : "bg-slate-50 ring-slate-200/70")
                      }
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">{c.title}</div>
                          <div className="mt-1 text-xs text-slate-600">
                            Cliente: {c.client_name ?? "-"} • Status: {c.status}
                          </div>
                        </div>
                        {badge ? (
                          <span className={"inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold " + badge.cls}>
                            {BadgeIcon ? <BadgeIcon className="h-4 w-4" /> : null}
                            {badge.label}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-2">
                        <div className="flex items-center gap-2">
                          <Scale className="h-4 w-4 text-slate-400" />
                          Advogado: {lawyer?.full_name ?? "-"}
                        </div>
                        <div className="flex items-center gap-2">
                          <Gavel className="h-4 w-4 text-slate-400" />
                          Prazo: {c.due_date ?? "-"}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {c.meeting_link ? (
                          <a
                            href={c.meeting_link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[#001f3f] px-3 text-xs font-semibold text-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.20)] transition-all duration-300 hover:bg-[#001a33]"
                          >
                            <LinkIcon className="h-4 w-4" />
                            Chamada
                          </a>
                        ) : null}
                        {c.notes ? (
                          <span className="inline-flex h-9 items-center justify-center rounded-xl bg-white px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70">
                            {c.notes.slice(0, 64)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl bg-slate-50 px-5 py-6 text-sm text-slate-600 ring-1 ring-slate-200/70">
                  Nenhum processo cadastrado.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
