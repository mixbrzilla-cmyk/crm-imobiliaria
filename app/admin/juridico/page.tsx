"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AlertTriangle,
  Briefcase,
  Calendar,
  CheckCircle2,
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

type RiskLevel = "verde" | "amarelo" | "vermelho";

type CertStatus = "negativa" | "positiva" | "pendente";

type DueDiligenceState = {
  cert_civel: CertStatus;
  cert_trabalhista: CertStatus;
  cert_protesto: CertStatus;
};

type TimelineStep = "peticao" | "citacao" | "audiencia" | "sentenca";

type TimelineEvent = {
  id: string;
  step: TimelineStep;
  date: string;
  description: string;
  tribunal_link: string;
  signature_status: "pendente" | "assinado";
};

type FeesState = {
  mode: "exito" | "pro_labore";
  amount_brl: string;
  due_date: string;
};

type LawyerRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  oab: string | null;
  meeting_link: string | null;
  practice_area?: string | null;
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
  tribunal_link?: string | null;
  due_diligence_json?: any;
  workflow_json?: any;
  fees_json?: any;
  signature_status?: "pendente" | "assinado" | null;
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
  practice_area: string;
};

type CaseForm = {
  title: string;
  client_name: string;
  status: CaseStatus;
  due_date: string;
  lawyer_id: string;
  meeting_link: string;
  tribunal_link: string;
  due_diligence: DueDiligenceState;
  fees: FeesState;
  signature_status: "pendente" | "assinado";
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

function parseDueDiligence(value: any): DueDiligenceState {
  const v = value ?? {};
  const norm = (x: any): CertStatus => {
    const s = String(x ?? "").toLowerCase().trim();
    if (s === "negativa") return "negativa";
    if (s === "positiva") return "positiva";
    return "pendente";
  };
  return {
    cert_civel: norm(v.cert_civel),
    cert_trabalhista: norm(v.cert_trabalhista),
    cert_protesto: norm(v.cert_protesto),
  };
}

function computeRiskLevel(args: { due: DueDiligenceState }) {
  const values = [args.due.cert_civel, args.due.cert_trabalhista, args.due.cert_protesto];
  if (values.includes("positiva")) return "vermelho" as RiskLevel;
  if (values.includes("pendente")) return "amarelo" as RiskLevel;
  return "verde" as RiskLevel;
}

function riskPresentation(level: RiskLevel) {
  if (level === "vermelho") {
    return {
      label: "Risco alto",
      dot: "bg-red-500",
      ring: "ring-red-200/70",
      card: "bg-red-50/60",
      text: "text-red-800",
    };
  }
  if (level === "amarelo") {
    return {
      label: "Risco médio",
      dot: "bg-amber-500",
      ring: "ring-amber-200/70",
      card: "bg-amber-50/60",
      text: "text-amber-900",
    };
  }
  return {
    label: "Risco baixo",
    dot: "bg-emerald-500",
    ring: "ring-emerald-200/70",
    card: "bg-emerald-50/60",
    text: "text-emerald-900",
  };
}

function parseFees(value: any): FeesState {
  const v = value ?? {};
  const mode = String(v.mode ?? "pro_labore").toLowerCase();
  return {
    mode: mode === "exito" ? "exito" : "pro_labore",
    amount_brl: typeof v.amount_brl === "string" ? v.amount_brl : "",
    due_date: typeof v.due_date === "string" ? v.due_date : "",
  };
}

function parseTimeline(value: any, fallback: { tribunal_link: string; signature_status: "pendente" | "assinado" }): TimelineEvent[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((e) => {
      const step = String(e?.step ?? "").toLowerCase();
      const stepNorm: TimelineStep =
        step === "citacao" || step === "sentenca" || step === "audiencia" ? (step as any) : "peticao";
      const signature = String(e?.signature_status ?? fallback.signature_status).toLowerCase();
      return {
        id: String(e?.id ?? crypto.randomUUID()),
        step: stepNorm,
        date: typeof e?.date === "string" ? e.date : "",
        description: typeof e?.description === "string" ? e.description : "",
        tribunal_link:
          typeof e?.tribunal_link === "string" && e.tribunal_link.trim()
            ? e.tribunal_link.trim()
            : fallback.tribunal_link,
        signature_status: signature === "assinado" ? "assinado" : "pendente",
      } as TimelineEvent;
    })
    .slice(0, 24);
}

function stepLabel(step: TimelineStep) {
  if (step === "citacao") return "Citação";
  if (step === "audiencia") return "Audiência";
  if (step === "sentenca") return "Sentença";
  return "Petição";
}

function officeStatusLabel(args: { red: number; yellow: number; green: number }) {
  if (args.red > 0) return "ALERTA: risco alto ativo";
  if (args.yellow > 0) return "Atenção: pendências de diligência";
  return "Operação jurídica sob controle";
}

function miniStepState(args: { hasInitial: boolean; hasCitacao: boolean; hasAudiencia: boolean }) {
  const step = (active: boolean) =>
    active
      ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/70"
      : "bg-slate-100 text-slate-600 ring-1 ring-slate-200/70";
  return {
    initial: step(args.hasInitial),
    citacao: step(args.hasCitacao),
    audiencia: step(args.hasAudiencia),
  };
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

  const [tab, setTab] = useState<"processos" | "advogados" | "minutas">("processos");

  const [riskFilter, setRiskFilter] = useState<"all" | RiskLevel>("all");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [lawyers, setLawyers] = useState<LawyerRow[]>([]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [docs, setDocs] = useState<DocumentRow[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [activeModal, setActiveModal] = useState<null | "case" | "lawyer" | "minuta">(null);

  const [lawyerForm, setLawyerForm] = useState<LawyerForm>({
    full_name: "",
    email: "",
    phone: "",
    oab: "",
    meeting_link: "",
    practice_area: "",
  });

  const [caseForm, setCaseForm] = useState<CaseForm>({
    title: "",
    client_name: "",
    status: "aberto",
    due_date: "",
    lawyer_id: "",
    meeting_link: "",
    tribunal_link: "",
    due_diligence: {
      cert_civel: "pendente",
      cert_trabalhista: "pendente",
      cert_protesto: "pendente",
    },
    fees: {
      mode: "pro_labore",
      amount_brl: "",
      due_date: "",
    },
    signature_status: "pendente",
    notes: "",
  });

  const [docForm, setDocForm] = useState<DocumentForm>({
    case_id: "",
    title: "",
    doc_type: "contrato",
    url: "",
  });

  const [editingFeesCaseId, setEditingFeesCaseId] = useState<string | null>(null);
  const [editingFees, setEditingFees] = useState<FeesState>({ mode: "pro_labore", amount_brl: "", due_date: "" });

  const [timelineModal, setTimelineModal] = useState<null | { caseId: string; step: TimelineStep }>(null);
  const [timelineDate, setTimelineDate] = useState<string>("");
  const [timelineResponsible, setTimelineResponsible] = useState<string>("");

  const [isActionSaving, setIsActionSaving] = useState(false);

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
      let [lawRes, caseRes, docRes] = await Promise.allSettled([
        (supabase as any)
          .from("legal_lawyers")
          .select("id, full_name, email, phone, oab, meeting_link, practice_area, created_at")
          .order("full_name", { ascending: true }),
        (supabase as any)
          .from("legal_cases")
          .select(
            "id, title, client_name, status, due_date, lawyer_id, meeting_link, tribunal_link, due_diligence_json, workflow_json, fees_json, signature_status, notes, created_at",
          )
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("legal_documents")
          .select("id, case_id, title, doc_type, url, created_at")
          .order("created_at", { ascending: false }),
      ]);

      const needsFallback =
        (lawRes.status === "fulfilled" && lawRes.value?.error) ||
        (caseRes.status === "fulfilled" && caseRes.value?.error);

      if (needsFallback) {
        [lawRes, caseRes, docRes] = await Promise.allSettled([
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
      }

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

  useEffect(() => {
    if (!supabase) return;

    let t: any = null;
    const channel = (supabase as any)
      .channel("admin-juridico-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "legal_cases" },
        () => {
          if (t) return;
          t = setTimeout(() => {
            t = null;
            void loadAll();
          }, 400);
        },
      )
      .subscribe();

    return () => {
      if (t) clearTimeout(t);
      try {
        (supabase as any).removeChannel(channel);
      } catch {
        return;
      }
    };
  }, [supabase, loadAll]);

  async function updateCaseJson(caseId: string, patch: Partial<CaseRow>, opts?: { successText?: string }) {
    setErrorMessage(null);
    setSuccessMessage(null);

    setCases((current) => current.map((c) => (c.id === caseId ? ({ ...c, ...(patch as any) } as any) : c)));

    setIsActionSaving(true);
    try {
      const res = await fetch("/api/legal-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", id: caseId, payload: patch }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const msg = String(json?.error ?? `Falha ao salvar (HTTP ${res.status})`);
        setErrorMessage(msg);
        await loadAll();
        return false;
      }

      setSuccessMessage(opts?.successText ?? "Salvo com sucesso.");
      await loadAll();
      return true;
    } catch (e: any) {
      setErrorMessage(e?.message ?? "Falha ao salvar.");
      await loadAll();
      return false;
    } finally {
      setIsActionSaving(false);
    }
  }

  async function toggleCert(caseId: string, key: keyof DueDiligenceState) {
    if (isActionSaving) return;
    const row = cases.find((c) => c.id === caseId);
    if (!row) return;
    const current = parseDueDiligence((row as any)?.due_diligence_json);
    const next: DueDiligenceState = { ...current };
    const cur = current[key];
    next[key] = cur === "pendente" ? "negativa" : cur === "negativa" ? "positiva" : "pendente";
    await updateCaseJson(caseId, { due_diligence_json: next } as any, { successText: "Certidão atualizada." });
  }

  async function openTimeline(caseId: string, step: TimelineStep) {
    const row = cases.find((c) => c.id === caseId);
    const signatureStatus = String((row as any)?.signature_status ?? "pendente").toLowerCase() === "assinado" ? "assinado" : "pendente";
    const workflow = parseTimeline((row as any)?.workflow_json, {
      tribunal_link: String((row as any)?.tribunal_link ?? row?.meeting_link ?? ""),
      signature_status: signatureStatus as any,
    });
    const existing = workflow.find((w) => w.step === step) ?? null;
    setTimelineDate(existing?.date ?? "");
    setTimelineResponsible("");
    setTimelineModal({ caseId, step });
  }

  async function saveTimelineEvent() {
    if (!timelineModal) return;
    if (isActionSaving) return;
    const caseId = timelineModal.caseId;
    const step = timelineModal.step;
    const row = cases.find((c) => c.id === caseId);
    if (!row) return;

    const existing = Array.isArray((row as any)?.workflow_json) ? ([...(row as any).workflow_json] as any[]) : [];
    const description = timelineResponsible.trim() ? `Responsável: ${timelineResponsible.trim()}` : "";
    const tribunalLink = String((row as any)?.tribunal_link ?? row.meeting_link ?? "").trim();
    const signatureStatus = String((row as any)?.signature_status ?? "pendente").toLowerCase() === "assinado" ? "assinado" : "pendente";

    const payloadEv: any = {
      id: crypto.randomUUID(),
      step,
      date: timelineDate,
      description,
      tribunal_link: tribunalLink,
      signature_status: signatureStatus,
    };

    const nextWorkflow = [payloadEv, ...existing].slice(0, 24);
    const ok = await updateCaseJson(caseId, { workflow_json: nextWorkflow } as any, { successText: "Timeline atualizada." });
    if (ok) setTimelineModal(null);
  }

  async function startEditFees(caseId: string) {
    const row = cases.find((c) => c.id === caseId);
    if (!row) return;
    setEditingFeesCaseId(caseId);
    setEditingFees(parseFees((row as any)?.fees_json));
  }

  async function saveFees(caseId: string) {
    if (isActionSaving) return;
    const ok = await updateCaseJson(caseId, { fees_json: editingFees } as any, { successText: "Honorários atualizados." });
    if (ok) setEditingFeesCaseId(null);
  }

  async function deleteCase(caseId: string) {
    if (isActionSaving) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    const caseTitle = (cases.find((c) => c.id === caseId)?.title ?? "").trim() || caseId;
    const ok = window.confirm(`Excluir o processo "${caseTitle}"?`);
    if (!ok) return;

    setIsActionSaving(true);
    try {
      const res = await fetch("/api/legal-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id: caseId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const msg = String(json?.error ?? `Falha ao excluir (HTTP ${res.status})`);
        setErrorMessage(msg);
        return;
      }
      setSuccessMessage("Processo excluído.");
      await loadAll();
    } catch (e: any) {
      setErrorMessage(e?.message ?? "Falha ao excluir.");
    } finally {
      setIsActionSaving(false);
    }
  }

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
        practice_area: lawyerForm.practice_area.trim() || null,
      };

      const { error } = await (supabase as any).from("legal_lawyers").insert(payload);
      if (error) {
        try {
          const retry: any = { ...payload };
          delete retry.practice_area;
          const { error: retryError } = await (supabase as any).from("legal_lawyers").insert(retry);
          if (retryError) {
            setErrorMessage(retryError.message);
            return;
          }
        } catch {
          setErrorMessage(error.message);
          return;
        }
      }

      setLawyerForm({ full_name: "", email: "", phone: "", oab: "", meeting_link: "", practice_area: "" });
      setActiveModal(null);
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
        tribunal_link: caseForm.tribunal_link.trim() || null,
        due_diligence_json: caseForm.due_diligence,
        fees_json: caseForm.fees,
        signature_status: caseForm.signature_status,
        workflow_json: [],
        notes: caseForm.notes.trim() || null,
      };

      const { error } = await (supabase as any).from("legal_cases").insert(payload);
      if (error) {
        try {
          const retry: any = { ...payload };
          delete retry.tribunal_link;
          delete retry.due_diligence_json;
          delete retry.fees_json;
          delete retry.signature_status;
          delete retry.workflow_json;
          const { error: retryError } = await (supabase as any).from("legal_cases").insert(retry);
          if (retryError) {
            setErrorMessage(retryError.message);
            return;
          }
        } catch {
          setErrorMessage(error.message);
          return;
        }
      }

      setCaseForm({
        title: "",
        client_name: "",
        status: "aberto",
        due_date: "",
        lawyer_id: "",
        meeting_link: "",
        tribunal_link: "",
        due_diligence: { cert_civel: "pendente", cert_trabalhista: "pendente", cert_protesto: "pendente" },
        fees: { mode: "pro_labore", amount_brl: "", due_date: "" },
        signature_status: "pendente",
        notes: "",
      });
      setActiveModal(null);
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
      const resolvedCaseId = tab === "minutas" ? null : docForm.case_id.trim() || null;
      const payload = {
        id: crypto.randomUUID(),
        case_id: resolvedCaseId,
        title: docForm.title.trim(),
        doc_type: docForm.doc_type,
        url: docForm.url.trim(),
      };

      const { error } = await (supabase as any).from("legal_documents").insert(payload);
      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setDocForm({ case_id: "", title: "", doc_type: "contrato", url: "" });
      setActiveModal(null);
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

  const dueDiligenceSummary = useMemo(() => {
    const all = cases.map((c) => parseDueDiligence((c as any)?.due_diligence_json));
    const total = all.length;
    const red = all.filter((d) => computeRiskLevel({ due: d }) === "vermelho").length;
    const yellow = all.filter((d) => computeRiskLevel({ due: d }) === "amarelo").length;
    const green = all.filter((d) => computeRiskLevel({ due: d }) === "verde").length;
    return { total, red, yellow, green };
  }, [cases]);

  const filteredCases = useMemo(() => {
    if (riskFilter === "all") return cases;
    return cases.filter((c) => {
      const due = parseDueDiligence((c as any)?.due_diligence_json);
      return computeRiskLevel({ due }) === riskFilter;
    });
  }, [cases, riskFilter]);

  const templateDocs = useMemo(() => {
    return docs.filter((d) => d.doc_type === "contrato" && !d.case_id);
  }, [docs]);

  const caseDocsById = useMemo(() => {
    const map = new Map<string, DocumentRow[]>();
    for (const d of docs) {
      if (!d.case_id) continue;
      const arr = map.get(d.case_id) ?? [];
      arr.push(d);
      map.set(d.case_id, arr);
    }
    return map;
  }, [docs]);

  return (
    <div className="min-h-screen w-full bg-slate-100 px-6 py-6">
      <div className="flex w-full flex-col gap-8">
        <header className="flex flex-col gap-2">
          <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">
            JURÍDICO • INTELIGÊNCIA DE RISCO
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Jurídico</h1>
          <p className="text-sm leading-relaxed text-slate-600">
            Centro de inteligência: semáforo de risco, workflow processual (timeline) e controle de honorários.
          </p>
        </header>

        {errorMessage ? (
          <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200/70">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-2xl bg-emerald-50 px-5 py-4 text-sm text-emerald-800 ring-1 ring-emerald-200/70">
            {successMessage}
          </div>
        ) : null}

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex w-full flex-col gap-4 md:flex-row md:items-start">
            <div className="w-full rounded-2xl bg-slate-50 p-4 shadow-lg ring-1 ring-slate-200/70 sm:p-5 md:min-w-[520px]">
              <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">STATUS DO ESCRITÓRIO</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">
                {officeStatusLabel({ red: dueDiligenceSummary.red, yellow: dueDiligenceSummary.yellow, green: dueDiligenceSummary.green })}
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setRiskFilter((cur) => (cur === "verde" ? "all" : "verde"))}
                  className={
                    "rounded-2xl bg-white p-4 text-left ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] " +
                    (riskFilter === "verde" ? "ring-emerald-300" : "")
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-slate-600">Verde</div>
                    <span className="h-3 w-3 rounded-full bg-emerald-500" />
                  </div>
                  <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{dueDiligenceSummary.green}</div>
                  <div className="mt-1 text-xs text-slate-500">Negativas</div>
                </button>
                <button
                  type="button"
                  onClick={() => setRiskFilter((cur) => (cur === "amarelo" ? "all" : "amarelo"))}
                  className={
                    "rounded-2xl bg-white p-4 text-left ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] " +
                    (riskFilter === "amarelo" ? "ring-amber-300" : "")
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-slate-600">Amarelo</div>
                    <span className="h-3 w-3 rounded-full bg-amber-500" />
                  </div>
                  <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{dueDiligenceSummary.yellow}</div>
                  <div className="mt-1 text-xs text-slate-500">Pendentes</div>
                </button>
                <button
                  type="button"
                  onClick={() => setRiskFilter((cur) => (cur === "vermelho" ? "all" : "vermelho"))}
                  className={
                    "rounded-2xl bg-white p-4 text-left ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] " +
                    (riskFilter === "vermelho" ? "ring-red-300" : "")
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-slate-600">Vermelho</div>
                    <span className="h-3 w-3 rounded-full bg-red-500" />
                  </div>
                  <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{dueDiligenceSummary.red}</div>
                  <div className="mt-1 text-xs text-slate-500">Positivas</div>
                </button>
              </div>
              <div className="mt-3 text-xs font-semibold text-slate-500">Total: {dueDiligenceSummary.total} processos</div>
            </div>

            <button
              type="button"
              onClick={() => void loadAll()}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50 sm:w-auto"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200/70 md:w-[420px]">
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
            onClick={() => setTab("minutas")}
            className={
              "flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-300 " +
              (tab === "minutas"
                ? "bg-white text-slate-900 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70"
                : "text-slate-600 hover:bg-white/70")
            }
          >
            <FileText className="h-4 w-4" />
            Minutas
          </button>
        </div>
        </div>
      </section>

      <section className="w-full">
        <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200/70">
            <div className="h-px w-full rounded-full bg-slate-200" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {tab === "advogados" ? "Advogados" : tab === "minutas" ? "Minutas / Contratos padrão" : "Processos"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {tab === "processos"
                    ? "Painel de controle de riscos: semáforo, mini-timeline e urgências."
                    : tab === "advogados"
                      ? "Perfis com área de atuação e contatos."
                      : "Repositório de minutas para uso operacional."}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs font-semibold text-slate-500">
                  {isLoading
                    ? "Atualizando..."
                    : tab === "advogados"
                      ? `${lawyers.length} itens`
                      : tab === "minutas"
                        ? `${templateDocs.length} itens`
                        : `${cases.length} itens`}
                </div>
                {tab === "processos" ? (
                  <button
                    type="button"
                    onClick={() => setActiveModal("case")}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#ff0000] px-4 text-xs font-semibold text-white shadow-lg transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#e60000]"
                  >
                    <Plus className="h-4 w-4" />
                    Novo Processo
                  </button>
                ) : tab === "advogados" ? (
                  <button
                    type="button"
                    onClick={() => setActiveModal("lawyer")}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#001f3f] px-4 text-xs font-semibold text-white shadow-lg transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#001a33]"
                  >
                    <Plus className="h-4 w-4" />
                    Novo Advogado
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveModal("minuta")}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#001f3f] px-4 text-xs font-semibold text-white shadow-lg transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#001a33]"
                  >
                    <Plus className="h-4 w-4" />
                    Nova Minuta
                  </button>
                )}
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
                          <div className="mt-1 text-xs font-semibold text-slate-500">{(l as any)?.practice_area ?? "-"}</div>
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
              ) : tab === "minutas" ? (
                templateDocs.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {templateDocs.map((d) => (
                      <div key={d.id} className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200/70">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900">{d.title}</div>
                            <div className="mt-1 text-xs text-slate-600">Contrato padrão</div>
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
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-slate-50 px-5 py-6 text-sm text-slate-600 ring-1 ring-slate-200/70">
                    Nenhuma minuta cadastrada.
                  </div>
                )
              ) : filteredCases.length > 0 ? (
                filteredCases.map((c) => {
                  const badge = deadlineBadge(c.due_date);
                  const lawyer = c.lawyer_id ? lawyerById.get(c.lawyer_id) : null;
                  const BadgeIcon = badge?.icon ?? null;
                  const due = parseDueDiligence((c as any)?.due_diligence_json);
                  const risk = computeRiskLevel({ due });
                  const riskUi = riskPresentation(risk);
                  const fees = parseFees((c as any)?.fees_json);
                  const feesBadge = fees?.due_date ? deadlineBadge(fees.due_date) : null;
                  const sig = (c as any)?.signature_status ? String((c as any).signature_status).toLowerCase() : "pendente";
                  const signatureStatus = sig === "assinado" ? "assinado" : "pendente";
                  const workflow = parseTimeline((c as any)?.workflow_json, {
                    tribunal_link: String((c as any)?.tribunal_link ?? c.meeting_link ?? ""),
                    signature_status: signatureStatus,
                  });

                  const isUrgent = Boolean(
                    badge && (badge.label === "Vencido" || badge.label.startsWith("Vence")),
                  );

                  const hasInitial = true;
                  const hasCitacao = workflow.some((w) => w.step === "citacao");
                  const hasAudiencia = workflow.some((w) => String((w as any)?.step ?? "").toLowerCase() === "audiencia");
                  const mini = miniStepState({ hasInitial, hasCitacao, hasAudiencia });

                  return (
                    <div
                      key={c.id}
                      className={
                        "relative rounded-2xl bg-white px-6 py-5 shadow-lg ring-1 ring-slate-200/70 border-t-4 " +
                        (isUrgent ? "border-t-red-500" : "border-t-[#2b6cff]")
                      }
                    >
                      <div
                        className={
                          "absolute right-4 top-4 rounded-2xl px-4 py-2 text-sm font-bold ring-1 " +
                          riskUi.card +
                          " " +
                          riskUi.ring +
                          " " +
                          riskUi.text
                        }
                      >
                        <div className="flex items-center gap-2">
                          <span className={"h-3 w-3 rounded-full " + riskUi.dot} />
                          {riskUi.label.toUpperCase()}
                        </div>
                      </div>

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

                      <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
                        <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-600">
                          <div>Mini-timeline</div>
                          <div className="text-[11px] font-semibold text-slate-500">[Inicial] → [Citação] → [Audiência]</div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void openTimeline(c.id, "peticao")}
                            className={"rounded-full px-3 py-1 text-xs font-semibold transition-all duration-300 hover:-translate-y-[1px] " + mini.initial}
                          >
                            Inicial
                          </button>
                          <span className="text-xs font-bold text-slate-400">→</span>
                          <button
                            type="button"
                            onClick={() => void openTimeline(c.id, "citacao")}
                            className={"rounded-full px-3 py-1 text-xs font-semibold transition-all duration-300 hover:-translate-y-[1px] " + mini.citacao}
                          >
                            Citação
                          </button>
                          <span className="text-xs font-bold text-slate-400">→</span>
                          <button
                            type="button"
                            onClick={() => void openTimeline(c.id, "audiencia")}
                            className={"rounded-full px-3 py-1 text-xs font-semibold transition-all duration-300 hover:-translate-y-[1px] " + mini.audiencia}
                          >
                            Audiência
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-2">
                        <div className="flex items-center gap-2">
                          <Scale className="h-4 w-4 text-slate-400" />
                          Advogado: {lawyer?.full_name ?? "-"}
                        </div>
                        <div className="flex items-center gap-2">
                          <Gavel className="h-4 w-4 text-slate-400" />
                          Prazo: {c.due_date ?? "-"}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/70">
                          <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">CERTIDÕES</div>
                          <div className="mt-3 grid grid-cols-1 gap-2">
                            {(
                              [
                                { label: "Cível", value: due.cert_civel },
                                { label: "Trabalhista", value: due.cert_trabalhista },
                                { label: "Protesto", value: due.cert_protesto },
                              ] as const
                            ).map((x) => {
                              const cls =
                                x.value === "positiva"
                                  ? "bg-red-50 text-red-800 ring-1 ring-red-200/70"
                                  : x.value === "negativa"
                                    ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/70"
                                    : "bg-amber-50 text-amber-900 ring-1 ring-amber-200/70";
                              return (
                                <div key={x.label} className="flex items-center justify-between gap-3">
                                  <div className="text-xs font-semibold text-slate-700">{x.label}</div>
                                  <button
                                    type="button"
                                    onClick={() => void toggleCert(c.id, x.label === "Cível" ? "cert_civel" : x.label === "Trabalhista" ? "cert_trabalhista" : "cert_protesto")}
                                    disabled={isActionSaving}
                                    className={"rounded-full px-3 py-1 text-xs font-semibold transition-all duration-300 hover:-translate-y-[1px] " + cls}
                                  >
                                    {x.value === "negativa" ? "Negativa" : x.value === "positiva" ? "Positiva" : "Pendente"}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/70">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">HONORÁRIOS</div>
                              <div className="mt-2 text-sm font-semibold text-slate-900">
                                {fees.mode === "exito" ? "Êxito" : "Pro-labore"}
                              </div>
                              <div className="mt-1 text-xs text-slate-600">
                                Valor: {fees.amount_brl ? `R$ ${fees.amount_brl}` : "-"}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => void startEditFees(c.id)}
                              className="inline-flex h-9 items-center justify-center rounded-xl bg-white px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-100"
                            >
                              Editar
                            </button>
                            {feesBadge ? (
                              <div className={"inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold " + feesBadge.cls}>
                                <Calendar className="h-4 w-4" />
                                {feesBadge.label}
                              </div>
                            ) : null}
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <div className="text-xs font-semibold text-slate-600">Vencimento</div>
                            <div className="text-xs font-semibold text-slate-800">{fees.due_date || "-"}</div>
                          </div>

                          {editingFeesCaseId === c.id ? (
                            <div className="mt-4 grid grid-cols-1 gap-3">
                              <label className="flex flex-col gap-2">
                                <span className="text-[11px] font-semibold tracking-wide text-slate-600">Modalidade</span>
                                <select
                                  value={editingFees.mode}
                                  onChange={(e) => setEditingFees((s) => ({ ...s, mode: e.target.value as any }))}
                                  className="h-10 rounded-xl bg-white px-3 text-xs text-slate-900 ring-1 ring-slate-200/70 outline-none"
                                >
                                  <option value="pro_labore">Pro-labore</option>
                                  <option value="exito">Êxito</option>
                                </select>
                              </label>
                              <label className="flex flex-col gap-2">
                                <span className="text-[11px] font-semibold tracking-wide text-slate-600">Valor (R$)</span>
                                <input
                                  value={editingFees.amount_brl}
                                  onChange={(e) => setEditingFees((s) => ({ ...s, amount_brl: e.target.value }))}
                                  className="h-10 rounded-xl bg-white px-3 text-xs text-slate-900 ring-1 ring-slate-200/70 outline-none"
                                  placeholder="Ex: 3000"
                                />
                              </label>
                              <label className="flex flex-col gap-2">
                                <span className="text-[11px] font-semibold tracking-wide text-slate-600">Vencimento</span>
                                <input
                                  type="date"
                                  value={editingFees.due_date}
                                  onChange={(e) => setEditingFees((s) => ({ ...s, due_date: e.target.value }))}
                                  className="h-10 rounded-xl bg-white px-3 text-xs text-slate-900 ring-1 ring-slate-200/70 outline-none"
                                />
                              </label>
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingFeesCaseId(null)}
                                  className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-100"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void saveFees(c.id)}
                                  disabled={isActionSaving}
                                  className="inline-flex h-10 items-center justify-center rounded-xl bg-[#001f3f] px-4 text-xs font-semibold text-white shadow-sm transition-all duration-300 hover:bg-[#001a33]"
                                >
                                  {isActionSaving ? "Salvando..." : "Salvar"}
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200/70">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">WORKFLOW (TIMELINE)</div>
                            <div className="mt-1 text-xs text-slate-600">Petição → Citação → Sentença</div>
                          </div>
                          {((c as any)?.tribunal_link || c.meeting_link) ? (
                            <a
                              href={String((c as any)?.tribunal_link ?? c.meeting_link)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-white px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-100"
                            >
                              <LinkIcon className="h-4 w-4" />
                              Tribunal
                            </a>
                          ) : null}
                        </div>

                        <div className="mt-4">
                          {workflow.length ? (
                            <div className="flex flex-col gap-3">
                              {workflow.map((ev, idx) => (
                                <div key={ev.id} className="flex items-start gap-3">
                                  <div className="mt-1 flex flex-col items-center">
                                    <div
                                      className={
                                        "h-3 w-3 rounded-full " +
                                        (ev.signature_status === "assinado" ? "bg-emerald-500" : "bg-slate-300")
                                      }
                                    />
                                    {idx < workflow.length - 1 ? (
                                      <div className="mt-1 h-full w-[2px] flex-1 bg-slate-200" />
                                    ) : null}
                                  </div>
                                  <div className="min-w-0 flex-1 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200/70">
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="text-xs font-semibold text-slate-900">{stepLabel(ev.step)}</div>
                                      <div className="text-[11px] font-semibold text-slate-500">{ev.date || "-"}</div>
                                    </div>
                                    <div className="mt-1 text-xs text-slate-600">{ev.description || "-"}</div>
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                      <div
                                        className={
                                          "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 " +
                                          (ev.signature_status === "assinado"
                                            ? "bg-emerald-50 text-emerald-800 ring-emerald-200/70"
                                            : "bg-amber-50 text-amber-900 ring-amber-200/70")
                                        }
                                      >
                                        {ev.signature_status === "assinado" ? (
                                          <CheckCircle2 className="h-4 w-4" />
                                        ) : null}
                                        {ev.signature_status === "assinado" ? "Assinado" : "Pendente"}
                                      </div>
                                      {ev.tribunal_link ? (
                                        <a
                                          href={ev.tribunal_link}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex h-8 items-center justify-center gap-2 rounded-xl bg-white px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70 transition-all hover:bg-slate-100"
                                        >
                                          <LinkIcon className="h-4 w-4" />
                                          Link
                                        </a>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600 ring-1 ring-slate-200/70">
                              Nenhum evento na timeline.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void deleteCase(c.id)}
                          disabled={isActionSaving}
                          className="inline-flex h-9 items-center justify-center rounded-xl bg-rose-600 px-3 text-xs font-semibold text-white shadow-sm transition-all duration-300 hover:bg-rose-700"
                        >
                          {isActionSaving ? "Excluindo..." : "Excluir Processo"}
                        </button>
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
                        <span
                          className={
                            "inline-flex h-9 items-center justify-center rounded-xl px-3 text-xs font-semibold ring-1 " +
                            (signatureStatus === "assinado"
                              ? "bg-emerald-50 text-emerald-800 ring-emerald-200/70"
                              : "bg-amber-50 text-amber-900 ring-amber-200/70")
                          }
                        >
                          Assinatura: {signatureStatus === "assinado" ? "Assinado" : "Pendente"}
                        </span>
                        {c.notes ? (
                          <span className="inline-flex h-9 items-center justify-center rounded-xl bg-white px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70">
                            {c.notes.slice(0, 64)}
                          </span>
                        ) : null}
                        {(caseDocsById.get(c.id)?.length ?? 0) > 0 ? (
                          <span className="inline-flex h-9 items-center justify-center rounded-xl bg-white px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70">
                            Docs: {caseDocsById.get(c.id)?.length ?? 0}
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
      </section>

      {timelineModal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center px-4 py-4 sm:items-center sm:py-8">
          <button
            type="button"
            onClick={() => setTimelineModal(null)}
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Fechar"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-slate-200/70"
          >
            <div className="border-b border-slate-100 px-6 py-5">
              <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">AÇÃO NA TIMELINE</div>
              <div className="mt-2 text-lg font-semibold tracking-tight text-slate-900">{stepLabel(timelineModal.step)}</div>
            </div>
            <div className="px-6 py-6">
              <div className="grid grid-cols-1 gap-4">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Data</span>
                  <input
                    type="date"
                    value={timelineDate}
                    onChange={(e) => setTimelineDate(e.target.value)}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none"
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Responsável</span>
                  <input
                    value={timelineResponsible}
                    onChange={(e) => setTimelineResponsible(e.target.value)}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none"
                    placeholder="Ex: Dr. Fulano / Assistente / Boss"
                  />
                </label>
              </div>
              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTimelineModal(null)}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void saveTimelineEvent()}
                  disabled={isActionSaving}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-[#2b6cff] px-5 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:bg-[#255fe6]"
                >
                  {isActionSaving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeModal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center px-4 py-4 sm:items-center sm:py-8">
          <button
            type="button"
            onClick={() => {
              if (isSaving) return;
              setActiveModal(null);
            }}
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Fechar"
          />

          <div
            role="dialog"
            aria-modal="true"
            className="relative flex w-full max-w-[95vw] flex-col overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-slate-200/70 sm:max-w-5xl"
            style={{ maxHeight: "90vh" }}
          >
            <div className="shrink-0 border-b border-slate-100 px-6 py-5">
              <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">
                {activeModal === "case" ? "NOVO PROCESSO" : activeModal === "lawyer" ? "NOVO ADVOGADO" : "NOVA MINUTA"}
              </div>
              <div className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                {activeModal === "case"
                  ? "Cadastro de Processo"
                  : activeModal === "lawyer"
                    ? "Cadastro de Advogado"
                    : "Cadastro de Minuta"}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {activeModal === "case" ? (
                <form onSubmit={addCase} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-2 md:col-span-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Título</span>
                    <input
                      value={caseForm.title}
                      onChange={(e) => setCaseForm((s) => ({ ...s, title: e.target.value }))}
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                      placeholder="Ex: Regularização / Usucapião / Contrato"
                      required
                    />
                  </label>

                  <label className="flex flex-col gap-2 md:col-span-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Cliente (opcional)</span>
                    <input
                      value={caseForm.client_name}
                      onChange={(e) => setCaseForm((s) => ({ ...s, client_name: e.target.value }))}
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                      placeholder="Nome"
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Status</span>
                    <select
                      value={caseForm.status}
                      onChange={(e) => setCaseForm((s) => ({ ...s, status: e.target.value as CaseStatus }))}
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none"
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
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none"
                    />
                  </label>

                  <label className="flex flex-col gap-2 md:col-span-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Advogado (opcional)</span>
                    <select
                      value={caseForm.lawyer_id}
                      onChange={(e) => setCaseForm((s) => ({ ...s, lawyer_id: e.target.value }))}
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none"
                    >
                      <option value="">Sem advogado</option>
                      {lawyers.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.full_name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-2 md:col-span-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Link de vídeo-chamada</span>
                    <div className="relative">
                      <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={caseForm.meeting_link}
                        onChange={(e) => setCaseForm((s) => ({ ...s, meeting_link: e.target.value }))}
                        className="h-11 w-full rounded-xl bg-white pl-10 pr-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none"
                        placeholder="https://meet..."
                      />
                    </div>
                  </label>

                  <label className="flex flex-col gap-2 md:col-span-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Observações</span>
                    <input
                      value={caseForm.notes}
                      onChange={(e) => setCaseForm((s) => ({ ...s, notes: e.target.value }))}
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none"
                      placeholder="Notas rápidas"
                    />
                  </label>

                  <div className="sticky bottom-0 -mx-6 mt-2 flex flex-col gap-2 border-t border-slate-100 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-end md:col-span-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (isSaving) return;
                        setActiveModal(null);
                      }}
                      className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200/70 hover:bg-slate-50 sm:w-auto"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#ff0000] px-6 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:bg-[#e60000] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      {isSaving ? "Salvando..." : "Salvar Processo"}
                    </button>
                  </div>
                </form>
              ) : activeModal === "lawyer" ? (
                <form onSubmit={addLawyer} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-2 md:col-span-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Nome</span>
                    <input
                      value={lawyerForm.full_name}
                      onChange={(e) => setLawyerForm((s) => ({ ...s, full_name: e.target.value }))}
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none"
                      placeholder="Nome completo"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Email</span>
                    <input
                      value={lawyerForm.email}
                      onChange={(e) => setLawyerForm((s) => ({ ...s, email: e.target.value }))}
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none"
                      placeholder="email@"
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Telefone</span>
                    <input
                      value={lawyerForm.phone}
                      onChange={(e) => setLawyerForm((s) => ({ ...s, phone: e.target.value }))}
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none"
                      placeholder="(DDD) ..."
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">OAB (opcional)</span>
                    <input
                      value={lawyerForm.oab}
                      onChange={(e) => setLawyerForm((s) => ({ ...s, oab: e.target.value }))}
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none"
                      placeholder="UF 123456"
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Área de atuação</span>
                    <input
                      value={lawyerForm.practice_area}
                      onChange={(e) => setLawyerForm((s) => ({ ...s, practice_area: e.target.value }))}
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none"
                      placeholder="Ex: Imobiliário, Contratos, Cível"
                    />
                  </label>
                  <label className="flex flex-col gap-2 md:col-span-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Link de vídeo-chamada</span>
                    <div className="relative">
                      <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={lawyerForm.meeting_link}
                        onChange={(e) => setLawyerForm((s) => ({ ...s, meeting_link: e.target.value }))}
                        className="h-11 w-full rounded-xl bg-white pl-10 pr-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none"
                        placeholder="https://meet..."
                      />
                    </div>
                  </label>
                  <div className="sticky bottom-0 -mx-6 mt-2 flex flex-col gap-2 border-t border-slate-100 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-end md:col-span-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (isSaving) return;
                        setActiveModal(null);
                      }}
                      className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200/70 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#001f3f] px-6 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:bg-[#001a33] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSaving ? "Salvando..." : "Salvar Advogado"}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={addDocument} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-2 md:col-span-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Título</span>
                    <input
                      value={docForm.title}
                      onChange={(e) => setDocForm((s) => ({ ...s, title: e.target.value }))}
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none"
                      placeholder="Contrato de compra e venda"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">Tipo</span>
                    <select
                      value={docForm.doc_type}
                      onChange={(e) => setDocForm((s) => ({ ...s, doc_type: e.target.value as DocumentType }))}
                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none"
                    >
                      <option value="contrato">Contrato</option>
                      <option value="certidao">Certidão</option>
                      <option value="outro">Outro</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-2 md:col-span-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-600">URL</span>
                    <div className="relative">
                      <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={docForm.url}
                        onChange={(e) => setDocForm((s) => ({ ...s, url: e.target.value }))}
                        className="h-11 w-full rounded-xl bg-white pl-10 pr-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none"
                        placeholder="https://drive..."
                        required
                      />
                    </div>
                  </label>
                  <div className="sticky bottom-0 -mx-6 mt-2 flex flex-col gap-2 border-t border-slate-100 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-end md:col-span-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (isSaving) return;
                        setActiveModal(null);
                      }}
                      className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200/70 hover:bg-slate-50 sm:w-auto"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#001f3f] px-6 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:bg-[#001a33] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      {isSaving ? "Salvando..." : "Salvar Minuta"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}
