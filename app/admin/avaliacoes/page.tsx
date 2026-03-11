"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Calendar,
  Camera,
  FileDown,
  Link as LinkIcon,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  SlidersHorizontal,
  Tag,
  X,
} from "lucide-react";

import { getSupabaseClient } from "@/lib/supabaseClient";
import { formatBRLInput, formatCurrencyBRL, parseBRLInputToNumber } from "@/lib/brl";

type AppraisalStatus = "solicitada" | "vistoria_agendada" | "em_elaboracao" | "entregue";

const ALLOWED_APPRAISAL_STATUS: readonly AppraisalStatus[] = [
  "solicitada",
  "vistoria_agendada",
  "em_elaboracao",
  "entregue",
];

type ParadigmRow = {
  id: string;
  label: string;
  area_m2: string;
  price: string;
  weight: string;
};

type FactorsState = {
  conservation: string;
  location: string;
  standard: string;
};

type LegalDocsState = {
  matricula_url: string;
  iptu_url: string;
  matricula_checked: boolean;
  iptu_checked: boolean;
};

type AppraisalRow = {
  id: string;
  client_name: string | null;
  address: string;
  neighborhood: string | null;
  city: string | null;
  scheduled_at: string | null;
  status: AppraisalStatus;
  area_m2: number | null;
  condition: string | null;
  suggested_price: number | null;
  fair_market_value?: number | null;
  paradigms_json?: any;
  factors_json?: any;
  evaluator_id?: string | null;
  inspection_date?: string | null;
  photos_urls?: string[] | null;
  notes: string | null;
  video_call_link: string | null;
  published_property_id: string | null;
  created_at?: string;
};

type FormState = {
  client_name: string;
  address: string;
  neighborhood: string;
  city: string;
  scheduled_at: string;
  status: AppraisalStatus;
  evaluator_id: string;
  inspection_date: string;
  area_m2: string;
  condition: string;
  suggested_price: string;
  fair_market_value: string;
  notes: string;
  video_call_link: string;
  paradigms: ParadigmRow[];
  factors: FactorsState;
  photos_urls: string[];
  legal_docs: LegalDocsState;
};

function computeMcdmTolerance(args: {
  samples: Array<{ area_m2: number | null; price: number | null }>;
  tolerancePct?: number;
}) {
  const tolerance = args.tolerancePct != null ? args.tolerancePct : 0.2;
  const valid = args.samples
    .map((s) => {
      const a = s.area_m2 ?? null;
      const p = s.price ?? null;
      if (!a || a <= 0) return null;
      if (!p || p <= 0) return null;
      return p / a;
    })
    .filter(Boolean) as number[];

  if (valid.length !== 3) {
    return {
      ppm2_avg: null as number | null,
      ppm2_min: null as number | null,
      ppm2_max: null as number | null,
      used: valid.length,
    };
  }

  const avg = valid.reduce((acc, v) => acc + v, 0) / valid.length;
  const min = avg * (1 - tolerance);
  const max = avg * (1 + tolerance);
  return {
    ppm2_avg: Number.isFinite(avg) ? avg : null,
    ppm2_min: Number.isFinite(min) ? min : null,
    ppm2_max: Number.isFinite(max) ? max : null,
    used: valid.length,
  };
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function safeText(value: string | null | undefined) {
  return (value ?? "").toString();
}

function parseOptionalFactor(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 1;
  const n = Number(trimmed.replace(",", "."));
  return Number.isFinite(n) ? n : 1;
}

function computeFairMarketValue(args: {
  subjectAreaM2: number | null;
  paradigms: Array<{ area_m2: number | null; price: number | null; weight: number | null }>;
  factors: { conservation: number; location: number; standard: number };
}) {
  const area = args.subjectAreaM2;
  if (!area || area <= 0) return null;

  const valid = args.paradigms
    .map((p) => {
      const a = p.area_m2 ?? null;
      const price = p.price ?? null;
      if (!a || a <= 0) return null;
      if (!price || price <= 0) return null;
      const ppm2 = price / a;
      const w = p.weight != null && p.weight > 0 ? p.weight : 1;
      return { ppm2, w };
    })
    .filter(Boolean) as Array<{ ppm2: number; w: number }>;

  if (valid.length === 0) return null;

  const sumW = valid.reduce((acc, v) => acc + v.w, 0);
  const avgPpm2 = sumW > 0 ? valid.reduce((acc, v) => acc + v.ppm2 * v.w, 0) / sumW : null;
  if (!avgPpm2) return null;

  const factorProduct = args.factors.conservation * args.factors.location * args.factors.standard;
  const raw = avgPpm2 * area * factorProduct;
  return Number.isFinite(raw) ? raw : null;
}

function buildLaudoHtml(appraisal: AppraisalRow) {
  const area = appraisal.area_m2 != null ? `${appraisal.area_m2} m²` : "-";
  const price = appraisal.suggested_price != null ? formatCurrencyBRL(appraisal.suggested_price) : "-";
  const scheduled = appraisal.scheduled_at ? new Date(appraisal.scheduled_at).toLocaleString("pt-BR") : "-";

  const css = `
    @page { size: A4; margin: 18mm; }
    * { box-sizing: border-box; }
    body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; color: #0f172a; }
    .top { display:flex; justify-content: space-between; align-items:flex-start; gap: 24px; }
    .brand { color:#001f3f; font-weight: 800; letter-spacing: 0.06em; font-size: 12px; }
    h1 { margin: 10px 0 0; font-size: 22px; color: #001f3f; }
    .sub { margin-top: 6px; font-size: 12px; color:#475569; }
    .badge { display:inline-block; padding: 6px 10px; border-radius: 999px; background:#ff0000; color:white; font-weight:700; font-size:11px; }
    .grid { margin-top: 18px; display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .card { border: 1px solid rgba(148,163,184,0.55); border-radius: 14px; padding: 14px; background: #ffffff; }
    .label { font-size: 11px; color:#64748b; font-weight: 700; letter-spacing: 0.06em; }
    .value { margin-top: 6px; font-size: 14px; color:#0f172a; font-weight: 600; }
    .notes { margin-top: 12px; }
    .divider { height: 1px; background: rgba(148,163,184,0.4); margin: 18px 0; }
    .footer { margin-top: 18px; font-size: 11px; color:#64748b; }
  `;

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Laudo de Avaliação</title>
        <style>${css}</style>
      </head>
      <body>
        <div class="top">
          <div>
            <div class="brand">AVALIAÇÃO TÉCNICA</div>
            <h1>Laudo de Vistoria e Avaliação</h1>
            <div class="sub">Relatório gerado pelo CRM • ${new Date().toLocaleString("pt-BR")}</div>
          </div>
          <div class="badge">CONFIDENCIAL</div>
        </div>

        <div class="divider"></div>

        <div class="grid">
          <div class="card">
            <div class="label">CLIENTE</div>
            <div class="value">${safeText(appraisal.client_name) || "-"}</div>
          </div>
          <div class="card">
            <div class="label">AGENDAMENTO</div>
            <div class="value">${scheduled}</div>
          </div>
          <div class="card">
            <div class="label">ENDEREÇO</div>
            <div class="value">${safeText(appraisal.address)}</div>
            <div class="sub">${safeText(appraisal.neighborhood) || "-"} • ${safeText(appraisal.city) || "-"}</div>
          </div>
          <div class="card">
            <div class="label">MÉTRAGEM</div>
            <div class="value">${area}</div>
          </div>
          <div class="card">
            <div class="label">ESTADO / CONSERVAÇÃO</div>
            <div class="value">${safeText(appraisal.condition) || "-"}</div>
          </div>
          <div class="card">
            <div class="label">VALOR SUGERIDO</div>
            <div class="value">${price}</div>
          </div>
        </div>

        <div class="notes">
          <div class="card">
            <div class="label">OBSERVAÇÕES</div>
            <div class="value" style="white-space: pre-wrap; font-weight: 500;">${safeText(appraisal.notes) || "-"}</div>
          </div>
        </div>

        <div class="footer">
          Este laudo é informativo e deve ser validado pela equipe técnica/jurídica antes de publicação.
        </div>
      </body>
    </html>
  `;

  return html;
}

export default function AvaliacoesAdminPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [rows, setRows] = useState<AppraisalRow[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AppraisalStatus>("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"basicos" | "paradigmas" | "fatores" | "midia" | "status">(
    "basicos",
  );

  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [selectedMatricula, setSelectedMatricula] = useState<File | null>(null);
  const [selectedIptu, setSelectedIptu] = useState<File | null>(null);
  const [ptamText, setPtamText] = useState<string>("");

  const [brokers, setBrokers] = useState<Array<{ id: string; full_name: string; cnai: string | null }>>([]);

  const [form, setForm] = useState<FormState>({
    client_name: "",
    address: "",
    neighborhood: "",
    city: "",
    scheduled_at: "",
    status: "solicitada",
    evaluator_id: "",
    inspection_date: "",
    area_m2: "",
    condition: "",
    suggested_price: "",
    fair_market_value: "",
    notes: "",
    video_call_link: "",
    paradigms: [
      { id: crypto.randomUUID(), label: "Paradigma 1", area_m2: "", price: "", weight: "1" },
    ],
    factors: {
      conservation: "1.00",
      location: "1.00",
      standard: "1.00",
    },
    photos_urls: [],
    legal_docs: {
      matricula_url: "",
      iptu_url: "",
      matricula_checked: false,
      iptu_checked: false,
    },
  });

  const selectedRow = useMemo(() => {
    if (!selectedId) return null;
    return rows.find((r) => r.id === selectedId) ?? null;
  }, [rows, selectedId]);

  const evaluatorCnai = useMemo(() => {
    if (!form.evaluator_id) return null;
    return brokers.find((b) => b.id === form.evaluator_id)?.cnai ?? null;
  }, [brokers, form.evaluator_id]);

  const complianceWarning = useMemo(() => {
    if (!form.evaluator_id) return null;
    const cnai = (evaluatorCnai ?? "").trim();
    if (cnai) return null;
    return "Avaliação sem validade jurídica (Falta CNAI)";
  }, [evaluatorCnai, form.evaluator_id]);

  const computedFairMarketValue = useMemo(() => {
    const subjectArea = parseOptionalNumber(form.area_m2);
    const paradigms = form.paradigms.map((p) => ({
      area_m2: parseOptionalNumber(p.area_m2),
      price: parseBRLInputToNumber(p.price),
      weight: parseOptionalNumber(p.weight),
    }));
    const factors = {
      conservation: parseOptionalFactor(form.factors.conservation),
      location: parseOptionalFactor(form.factors.location),
      standard: parseOptionalFactor(form.factors.standard),
    };
    return computeFairMarketValue({ subjectAreaM2: subjectArea, paradigms, factors });
  }, [form.area_m2, form.factors, form.paradigms]);

  const mcdmTolerance = useMemo(() => {
    const firstThree = form.paradigms.slice(0, 3).map((p) => ({
      area_m2: parseOptionalNumber(p.area_m2),
      price: parseBRLInputToNumber(p.price),
    }));
    return computeMcdmTolerance({ samples: firstThree, tolerancePct: 0.2 });
  }, [form.paradigms]);

  const legalDocsOk = useMemo(() => {
    const docs = form.legal_docs;
    if (!docs) return false;
    const hasUrls = Boolean(docs.matricula_url.trim()) && Boolean(docs.iptu_url.trim());
    const checked = Boolean(docs.matricula_checked) && Boolean(docs.iptu_checked);
    return hasUrls && checked;
  }, [form.legal_docs]);

  useEffect(() => {
    setForm((s) => ({
      ...s,
      fair_market_value:
        computedFairMarketValue != null ? formatCurrencyBRL(computedFairMarketValue) : "",
    }));
  }, [computedFairMarketValue]);

  const load = useCallback(async () => {
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      setRows([]);
      return;
    }

    setIsLoading(true);

    try {
      let res: any = await (supabase as any)
        .from("property_appraisals")
        .select(
          "id, client_name, address, neighborhood, city, scheduled_at, status, area_m2, condition, suggested_price, fair_market_value, paradigms_json, factors_json, evaluator_id, inspection_date, photos_urls, notes, video_call_link, published_property_id, created_at",
        )
        .order("created_at", { ascending: false });

      if (res.error) {
        res = await (supabase as any)
          .from("property_appraisals")
          .select(
            "id, client_name, address, neighborhood, city, scheduled_at, status, area_m2, condition, suggested_price, notes, video_call_link, published_property_id, created_at",
          )
          .order("created_at", { ascending: false });
      }

      if (res.error) {
        setErrorMessage(res.error.message);
        setRows([]);
      } else {
        const data = (res.data ?? []) as any[];
        const normalized = data.map((r) => {
          const s = String(r.status ?? "").toLowerCase();
          const mapped: AppraisalStatus =
            s === "vistoria_agendada" || s === "solicitada" || s === "em_elaboracao" || s === "entregue"
              ? (s as AppraisalStatus)
              : s === "agendada"
                ? "vistoria_agendada"
                : s === "realizada" || s === "laudo_emitido"
                  ? "em_elaboracao"
                  : "entregue";
          return { ...r, status: mapped } as AppraisalRow;
        });
        setRows(normalized);
      }
    } catch {
      setErrorMessage("Não foi possível carregar as avaliações agora.");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  async function uploadLegalDoc(kind: "matricula" | "iptu") {
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    if (!selectedId) {
      setErrorMessage("Salve a avaliação antes de enviar os documentos.");
      return;
    }

    const file = kind === "matricula" ? selectedMatricula : selectedIptu;
    if (!file) return;

    setUploadingDocs(true);
    try {
      const bucket = (supabase as any).storage.from("appraisals");
      const safeName = file.name.replace(/\s+/g, "-");
      const path = `${selectedId}/docs/${kind}-${Date.now()}-${safeName}`;
      const up = await bucket.upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (up?.error) {
        setErrorMessage(up.error.message);
        return;
      }

      const pub = bucket.getPublicUrl(path);
      const url = pub?.data?.publicUrl ? String(pub.data.publicUrl) : "";
      if (!url) {
        setErrorMessage("Upload concluído, mas não foi possível obter a URL pública.");
        return;
      }

      setForm((s) => {
        const nextDocs = {
          ...s.legal_docs,
          ...(kind === "matricula" ? { matricula_url: url } : { iptu_url: url }),
        };
        return { ...s, legal_docs: nextDocs };
      });

      try {
        const docsPayload: any = {
          legal_docs_json: {
            matricula_url:
              kind === "matricula" ? url : form.legal_docs.matricula_url.trim() || null,
            iptu_url: kind === "iptu" ? url : form.legal_docs.iptu_url.trim() || null,
            matricula_checked: Boolean(form.legal_docs.matricula_checked),
            iptu_checked: Boolean(form.legal_docs.iptu_checked),
          },
        };
        const res = await (supabase as any)
          .from("property_appraisals")
          .update(docsPayload)
          .eq("id", selectedId);
        if (res?.error) {
          setErrorMessage(res.error.message);
        }
      } catch {
        setErrorMessage("Documento enviado, mas não foi possível vincular ao registro.");
      }

      if (kind === "matricula") setSelectedMatricula(null);
      if (kind === "iptu") setSelectedIptu(null);
    } catch {
      setErrorMessage("Não foi possível enviar o documento agora.");
    } finally {
      setUploadingDocs(false);
    }
  }

  function generatePtamSummary() {
    const subjectArea = parseOptionalNumber(form.area_m2);
    const avgPpm2 = mcdmTolerance.ppm2_avg;
    const minPpm2 = mcdmTolerance.ppm2_min;
    const maxPpm2 = mcdmTolerance.ppm2_max;
    const suggested = parseBRLInputToNumber(form.suggested_price);
    const computed = computedFairMarketValue;

    const lines: string[] = [];
    lines.push("PTAM — Parecer Técnico de Avaliação Mercadológica");
    lines.push("");
    lines.push(`Imóvel (avaliando): ${form.address.trim() || "-"}`);
    lines.push(
      `Bairro/Cidade: ${(form.neighborhood.trim() || "-") + " • " + (form.city.trim() || "-")}`,
    );
    lines.push(`Data da vistoria: ${form.inspection_date || "-"}`);
    lines.push(`Área privativa: ${subjectArea != null ? `${subjectArea} m²` : "-"}`);
    lines.push(`Conservação (norma): ${form.condition || "-"}`);
    lines.push("");
    lines.push("Método: MCDM (Método Comparativo Direto de Mercado) — NBR 14653");
    lines.push("Amostras (3 imóveis vizinhos):");
    form.paradigms.slice(0, 3).forEach((p, idx) => {
      const a = parseOptionalNumber(p.area_m2);
      const pr = parseBRLInputToNumber(p.price);
      const ppm2 = a && pr ? pr / a : null;
      lines.push(
        `  ${idx + 1}. ${p.label || `Amostra ${idx + 1}`} — Área: ${a != null ? a : "-"} m² — Preço: ${pr != null ? formatCurrencyBRL(pr) : "-"} — R$/m²: ${ppm2 != null ? formatCurrencyBRL(ppm2) : "-"}`,
      );
    });
    lines.push("");
    lines.push(
      `R$/m² médio: ${avgPpm2 != null ? formatCurrencyBRL(avgPpm2) : "-"} (tolerância ±20%)`,
    );
    lines.push(
      `Intervalo NBR: ${minPpm2 != null ? formatCurrencyBRL(minPpm2) : "-"} a ${maxPpm2 != null ? formatCurrencyBRL(maxPpm2) : "-"}`,
    );
    lines.push("");
    lines.push(`Valor sugerido (manual): ${suggested != null ? formatCurrencyBRL(suggested) : "-"}`);
    lines.push(`Valor justo (calculado): ${computed != null ? formatCurrencyBRL(computed) : "-"}`);
    lines.push("");
    lines.push("Checklist jurídico (trava):");
    lines.push(
      `  Matrícula: ${form.legal_docs.matricula_url ? "ENVIADA" : "PENDENTE"} • Conferida: ${form.legal_docs.matricula_checked ? "SIM" : "NÃO"}`,
    );
    lines.push(
      `  IPTU: ${form.legal_docs.iptu_url ? "ENVIADO" : "PENDENTE"} • Conferido: ${form.legal_docs.iptu_checked ? "SIM" : "NÃO"}`,
    );
    if (form.notes.trim()) {
      lines.push("");
      lines.push("Observações técnicas:");
      lines.push(form.notes.trim());
    }
    setPtamText(lines.join("\n"));
  }

  const loadBrokers = useCallback(async () => {
    if (!supabase) {
      setBrokers([]);
      return;
    }

    try {
      let res: any = await (supabase as any)
        .from("profiles")
        .select("id, full_name, cnai")
        .eq("role", "broker")
        .order("full_name", { ascending: true });

      if (res.error) {
        res = await (supabase as any)
          .from("profiles")
          .select("id, full_name")
          .eq("role", "broker")
          .order("full_name", { ascending: true });
      }

      if (res.error) {
        setBrokers([]);
        return;
      }

      const data = (res.data ?? []) as any[];
      setBrokers(
        data.map((r) => ({
          id: String(r.id),
          full_name: String(r.full_name ?? r.id),
          cnai: r.cnai != null ? String(r.cnai) : null,
        })),
      );
    } catch {
      setBrokers([]);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
    void loadBrokers();
  }, [load]);

  function resetForm() {
    setSelectedId(null);
    setActiveTab("basicos");
    setSelectedFiles([]);
    setSelectedMatricula(null);
    setSelectedIptu(null);
    setPtamText("");
    setForm({
      client_name: "",
      address: "",
      neighborhood: "",
      city: "",
      scheduled_at: "",
      status: "solicitada",
      evaluator_id: "",
      inspection_date: "",
      area_m2: "",
      condition: "",
      suggested_price: "",
      fair_market_value: "",
      notes: "",
      video_call_link: "",
      paradigms: [{ id: crypto.randomUUID(), label: "Paradigma 1", area_m2: "", price: "", weight: "1" }],
      factors: { conservation: "1.00", location: "1.00", standard: "1.00" },
      photos_urls: [],
      legal_docs: {
        matricula_url: "",
        iptu_url: "",
        matricula_checked: false,
        iptu_checked: false,
      },
    });
  }

  function openNew() {
    resetForm();
    setIsModalOpen(true);
  }

  function openEdit(row: AppraisalRow) {
    setSelectedId(row.id);
    setActiveTab("basicos");
    const paradigmsFromDb = Array.isArray((row as any)?.paradigms_json) ? (row as any).paradigms_json : null;
    const factorsFromDb = (row as any)?.factors_json ?? null;
    const legalDocsFromDb = (row as any)?.legal_docs_json ?? null;

    setForm({
      client_name: row.client_name ?? "",
      address: row.address ?? "",
      neighborhood: row.neighborhood ?? "",
      city: row.city ?? "",
      scheduled_at: row.scheduled_at ? String(row.scheduled_at).slice(0, 16) : "",
      status: row.status ?? "solicitada",
      evaluator_id: (row as any)?.evaluator_id ?? "",
      inspection_date: (row as any)?.inspection_date ? String((row as any).inspection_date).slice(0, 10) : "",
      area_m2: row.area_m2 != null ? String(row.area_m2) : "",
      condition: row.condition ?? "",
      suggested_price:
        typeof row.suggested_price === "number" ? formatCurrencyBRL(row.suggested_price) : "",
      fair_market_value:
        typeof (row as any)?.fair_market_value === "number"
          ? formatCurrencyBRL((row as any).fair_market_value)
          : "",
      notes: row.notes ?? "",
      video_call_link: row.video_call_link ?? "",
      paradigms:
        paradigmsFromDb && paradigmsFromDb.length
          ? paradigmsFromDb.map((p: any) => ({
              id: String(p.id ?? crypto.randomUUID()),
              label: String(p.label ?? "Paradigma"),
              area_m2: p.area_m2 != null ? String(p.area_m2) : "",
              price: p.price != null ? formatCurrencyBRL(Number(p.price)) : "",
              weight: p.weight != null ? String(p.weight) : "1",
            }))
          : [{ id: crypto.randomUUID(), label: "Paradigma 1", area_m2: "", price: "", weight: "1" }],
      factors: {
        conservation:
          factorsFromDb?.conservation != null ? String(factorsFromDb.conservation) : "1.00",
        location: factorsFromDb?.location != null ? String(factorsFromDb.location) : "1.00",
        standard: factorsFromDb?.standard != null ? String(factorsFromDb.standard) : "1.00",
      },
      photos_urls: Array.isArray((row as any)?.photos_urls) ? ((row as any).photos_urls as string[]) : [],
      legal_docs: {
        matricula_url:
          legalDocsFromDb?.matricula_url != null ? String(legalDocsFromDb.matricula_url) : "",
        iptu_url: legalDocsFromDb?.iptu_url != null ? String(legalDocsFromDb.iptu_url) : "",
        matricula_checked: Boolean(legalDocsFromDb?.matricula_checked),
        iptu_checked: Boolean(legalDocsFromDb?.iptu_checked),
      },
    });

    setIsModalOpen(true);
  }

  async function saveAppraisal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    if (!form.address.trim()) {
      setErrorMessage("Endereço é obrigatório.");
      return;
    }

    if (form.status === "entregue" && !legalDocsOk) {
      setErrorMessage(
        "Trava jurídica: para finalizar (Entregue/Laudo finalizado), envie Matrícula e IPTU e marque ambos como Conferidos.",
      );
      return;
    }

    setIsSaving(true);

    const normalizedStatus = String(form.status ?? "")
      .toLowerCase()
      .trim() as AppraisalStatus;
    const safeStatus: AppraisalStatus = (ALLOWED_APPRAISAL_STATUS as readonly string[]).includes(normalizedStatus)
      ? normalizedStatus
      : "solicitada";

    const payloadBase: any = {
      id: selectedId ?? crypto.randomUUID(),
      client_name: form.client_name.trim() || null,
      address: form.address.trim(),
      neighborhood: form.neighborhood.trim() || null,
      city: form.city.trim() || null,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      status: selectedId ? safeStatus : "solicitada",
      evaluator_id: form.evaluator_id.trim() ? form.evaluator_id.trim() : null,
      inspection_date: form.inspection_date ? form.inspection_date : null,
      area_m2: parseOptionalNumber(form.area_m2),
      condition: form.condition.trim() || null,
      suggested_price: parseBRLInputToNumber(form.suggested_price),
      fair_market_value: computedFairMarketValue,
      paradigms_json: form.paradigms.map((p) => ({
        id: p.id,
        label: p.label,
        area_m2: parseOptionalNumber(p.area_m2),
        price: parseBRLInputToNumber(p.price),
        weight: parseOptionalNumber(p.weight),
      })),
      factors_json: {
        conservation: parseOptionalFactor(form.factors.conservation),
        location: parseOptionalFactor(form.factors.location),
        standard: parseOptionalFactor(form.factors.standard),
      },
      photos_urls: form.photos_urls.length ? form.photos_urls : null,
      legal_docs_json: {
        matricula_url: form.legal_docs.matricula_url.trim() || null,
        iptu_url: form.legal_docs.iptu_url.trim() || null,
        matricula_checked: Boolean(form.legal_docs.matricula_checked),
        iptu_checked: Boolean(form.legal_docs.iptu_checked),
      },
      notes: form.notes.trim() || null,
      video_call_link: form.video_call_link.trim() || null,
      published_property_id: selectedRow?.published_property_id ?? null,
    };

    try {
      const query = (supabase as any).from("property_appraisals");
      const res = selectedId
        ? await query.update(payloadBase).eq("id", selectedId)
        : await query.insert(payloadBase);
      if (res?.error) throw res.error;

      setIsSaving(false);
      setIsModalOpen(false);
      resetForm();
      await load();
    } catch {
      try {
        const retry: any = { ...payloadBase };
        delete retry.fair_market_value;
        delete retry.paradigms_json;
        delete retry.factors_json;
        delete retry.legal_docs_json;
        delete retry.evaluator_id;
        delete retry.inspection_date;
        delete retry.photos_urls;
        const query = (supabase as any).from("property_appraisals");
        const res = selectedId
          ? await query.update(retry).eq("id", selectedId)
          : await query.insert(retry);
        if (res?.error) {
          setErrorMessage(res.error.message);
          setIsSaving(false);
          return;
        }

        setIsSaving(false);
        setIsModalOpen(false);
        resetForm();
        await load();
      } catch {
        setIsSaving(false);
        setErrorMessage("Não foi possível salvar a avaliação.");
      }
    }
  }

  async function uploadInspectionPhotos() {
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    if (!selectedId) {
      setErrorMessage("Salve a avaliação antes de enviar fotos.");
      return;
    }

    if (!form.inspection_date) {
      setErrorMessage("Informe a data da vistoria para registrar os metadados.");
      return;
    }

    if (selectedFiles.length === 0) return;

    setUploadingPhotos(true);
    try {
      const bucket = (supabase as any).storage.from("appraisals");
      const inspectionDate = form.inspection_date;
      const uploadedUrls: string[] = [];

      for (const file of selectedFiles) {
        const safeName = file.name.replace(/\s+/g, "-");
        const path = `${selectedId}/${inspectionDate}-${Date.now()}-${safeName}`;
        const up = await bucket.upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (up?.error) {
          setErrorMessage(up.error.message);
          setUploadingPhotos(false);
          return;
        }

        const pub = bucket.getPublicUrl(path);
        const url = pub?.data?.publicUrl ? String(pub.data.publicUrl) : "";
        if (url) uploadedUrls.push(url);
      }

      const merged = [...form.photos_urls, ...uploadedUrls];
      setForm((s) => ({ ...s, photos_urls: merged }));

      try {
        const res = await (supabase as any)
          .from("property_appraisals")
          .update({ photos_urls: merged })
          .eq("id", selectedId);
        if (res?.error) {
          setErrorMessage(res.error.message);
        }
      } catch {
        setErrorMessage("Fotos enviadas, mas não foi possível vincular ao registro.");
      }

      setSelectedFiles([]);
    } catch {
      setErrorMessage("Não foi possível enviar as fotos agora.");
    } finally {
      setUploadingPhotos(false);
    }
  }

  function exportPdf(appraisal: AppraisalRow) {
    const html = buildLaudoHtml(appraisal);
    const win = window.open("", "_blank");
    if (!win) {
      setErrorMessage("Pop-up bloqueado. Permita pop-ups para gerar o PDF.");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();

    const tryPrint = () => {
      win.focus();
      win.print();
    };

    setTimeout(tryPrint, 250);
  }

  async function publishToCatalog(appraisal: AppraisalRow) {
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    if (appraisal.published_property_id) return;

    setPublishingId(appraisal.id);

    try {
      const propertyId = crypto.randomUUID();
      const title = `Avaliação • ${appraisal.address}`;
      const descriptionParts = [
        appraisal.condition ? `Estado: ${appraisal.condition}` : null,
        appraisal.notes ? `Observações: ${appraisal.notes}` : null,
      ].filter(Boolean);

      const payload = {
        id: propertyId,
        title,
        property_type: "Apartamento",
        purpose: "venda",
        price: appraisal.suggested_price,
        neighborhood: appraisal.neighborhood,
        city: appraisal.city,
        area_m2: appraisal.area_m2,
        status: "disponivel",
        description: descriptionParts.length > 0 ? descriptionParts.join("\n") : null,
      };

      const insertRes = await (supabase as any).from("properties").insert(payload);
      if (insertRes.error) {
        setErrorMessage(insertRes.error.message);
        return;
      }

      const updateRes = await (supabase as any)
        .from("property_appraisals")
        .update({ published_property_id: propertyId })
        .eq("id", appraisal.id);

      if (updateRes.error) {
        setErrorMessage(updateRes.error.message);
        return;
      }

      await load();
    } catch {
      setErrorMessage("Não foi possível publicar no catálogo.");
    } finally {
      setPublishingId(null);
    }
  }

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      const address = String(r.address ?? "").toLowerCase();
      const neighborhood = String(r.neighborhood ?? "").toLowerCase();
      const city = String(r.city ?? "").toLowerCase();
      const client = String(r.client_name ?? "").toLowerCase();
      return address.includes(q) || neighborhood.includes(q) || city.includes(q) || client.includes(q);
    });
  }, [rows, search, statusFilter]);

  const columns: Array<{ key: AppraisalStatus; title: string; subtitle: string }> = [
    { key: "solicitada", title: "Solicitada", subtitle: "Entrada / triagem" },
    { key: "vistoria_agendada", title: "Vistoria Agendada", subtitle: "Campo / coleta" },
    { key: "em_elaboracao", title: "Em Elaboração", subtitle: "PTAM / MCDM" },
    { key: "entregue", title: "Entregue", subtitle: "Laudo final" },
  ];

  return (
    <div className="min-h-screen w-full bg-slate-100 px-6 py-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">AVALIAÇÕES • PTAM • MCDM</div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-800">Avaliações</h1>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50 sm:w-auto"
              >
                <RefreshCw className="h-4 w-4" />
                Recarregar
              </button>
              <button
                type="button"
                onClick={() => openNew()}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#2b6cff] px-5 text-sm font-semibold text-white shadow-[0_10px_26px_-18px_rgba(43,108,255,0.85)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#255fe6] sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                Nova Avaliação
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
              <div className="relative w-full md:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-11 w-full rounded-xl bg-slate-50 pl-10 pr-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#2b6cff]/40"
                  placeholder="Buscar por endereço, bairro, cidade, cliente..."
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200/70">
                  <SlidersHorizontal className="h-4 w-4 text-slate-500" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="bg-transparent text-xs font-semibold text-slate-700 outline-none"
                  >
                    <option value="all">Status: Todos</option>
                    <option value="solicitada">Solicitada</option>
                    <option value="vistoria_agendada">Vistoria Agendada</option>
                    <option value="em_elaboracao">Em Elaboração</option>
                    <option value="entregue">Entregue</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="text-xs font-semibold text-slate-500">
              {isLoading ? "Atualizando..." : `${filteredRows.length} itens`}
            </div>
          </div>
        </header>

      {errorMessage ? (
        <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200/70">
          {errorMessage}
        </div>
      ) : null}

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {columns.map((col) => {
            const items = filteredRows.filter((r) => r.status === col.key);
            return (
              <div key={col.key} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{col.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{col.subtitle}</div>
                  </div>
                  <div className="inline-flex h-8 items-center justify-center rounded-full bg-slate-50 px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70">
                    {items.length}
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3">
                  {items.length ? (
                    items.map((r) => {
                      const fair = (r as any)?.fair_market_value;
                      const fairLabel = typeof fair === "number" ? formatCurrencyBRL(fair) : "-";
                      const suggested = r.suggested_price != null ? formatCurrencyBRL(r.suggested_price) : "-";
                      const hasCnaiWarning = !(brokers.find((b) => b.id === (r as any)?.evaluator_id)?.cnai ?? "")
                        .toString()
                        .trim();

                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => openEdit(r)}
                          className="group w-full rounded-2xl bg-slate-50 px-4 py-4 text-left ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-white hover:shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-slate-900">{r.address}</div>
                              <div className="mt-1 text-xs font-semibold text-slate-500">
                                {r.neighborhood ?? "-"} • {r.city ?? "-"}
                              </div>
                            </div>
                            <div className="shrink-0">
                              <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/70">
                                {fairLabel}
                              </div>
                              <div className="mt-2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200/70">
                                {suggested}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            {hasCnaiWarning && (r as any)?.evaluator_id ? (
                              <div className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 ring-1 ring-amber-200/70">
                                <ShieldAlert className="h-4 w-4" />
                                Falta CNAI
                              </div>
                            ) : null}
                            <div className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70">
                              <Tag className="h-4 w-4 text-slate-400" />
                              {r.area_m2 != null ? `${r.area_m2} m²` : "-"}
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70">
                              <MapPin className="h-4 w-4 text-slate-400" />
                              {r.condition ?? "-"}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-600 ring-1 ring-slate-200/70">
                      Nenhuma avaliação.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        {isModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
            <button
              type="button"
              onClick={() => {
                if (isSaving || uploadingPhotos) return;
                setIsModalOpen(false);
                resetForm();
              }}
              className="absolute inset-0 bg-slate-900/40"
              aria-label="Fechar"
            />

            <div
              role="dialog"
              aria-modal="true"
              className="relative flex w-full max-w-5xl max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200/70"
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                <div>
                  <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">PTAM • PARECER TÉCNICO</div>
                  <div className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                    {selectedId ? "Avaliação técnica" : "Nova avaliação"}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    Funil: Solicitada · Vistoria Agendada · Em Elaboração · Entregue
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (isSaving || uploadingPhotos) return;
                      setIsModalOpen(false);
                      resetForm();
                    }}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-700 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Fechar"
                    disabled={isSaving || uploadingPhotos}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">

              {complianceWarning ? (
                <div className="px-6 pt-5">
                  <div className="rounded-2xl bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-900 ring-1 ring-amber-200/70">
                    {complianceWarning}
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-6 px-6 py-6 md:grid-cols-12">
                <div className="md:col-span-3">
                  <div className="flex flex-col gap-2 rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200/70">
                    {(
                      [
                        { key: "basicos", label: "Dados Básicos" },
                        { key: "paradigmas", label: "Paradigmas" },
                        { key: "fatores", label: "Fatores" },
                        { key: "midia", label: "Relatório Fotográfico" },
                        { key: "status", label: "Status/Publicação" },
                      ] as const
                    ).map((t) => {
                      const isActive = t.key === activeTab;
                      return (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => setActiveTab(t.key)}
                          className={
                            "flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-semibold transition-all duration-300 " +
                            (isActive
                              ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/70"
                              : "text-slate-600 hover:bg-white/70")
                          }
                        >
                          <span>{t.label}</span>
                          <span className="text-xs font-semibold text-slate-400">▸</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
                    <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">VALOR JUSTO</div>
                    <div className="mt-2 text-2xl font-semibold tracking-tight text-emerald-600">
                      {computedFairMarketValue != null ? formatCurrencyBRL(computedFairMarketValue) : "-"}
                    </div>
                    <div className="mt-2 text-xs font-semibold text-slate-500">Atualizado automaticamente</div>
                  </div>
                </div>

                <div className="md:col-span-9">
                  <form id="appraisal-form" onSubmit={saveAppraisal} className="flex flex-col gap-4">
                    {activeTab === "basicos" ? (
                      <>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <label className="flex flex-col gap-2">
                            <span className="text-xs font-semibold tracking-wide text-slate-600">Avaliador (Corretor)</span>
                            <select
                              value={form.evaluator_id}
                              onChange={(e) => setForm((s) => ({ ...s, evaluator_id: e.target.value }))}
                              className="h-11 rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#2b6cff]/30"
                            >
                              <option value="">Selecionar avaliador</option>
                              {brokers.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.full_name}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="flex flex-col gap-2">
                            <span className="text-xs font-semibold tracking-wide text-slate-600">Data da vistoria</span>
                            <input
                              type="date"
                              value={form.inspection_date}
                              onChange={(e) => setForm((s) => ({ ...s, inspection_date: e.target.value }))}
                              className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#2b6cff]/30"
                            />
                          </label>
                        </div>

                        <label className="flex flex-col gap-2">
                          <span className="text-xs font-semibold tracking-wide text-slate-600">Cliente (opcional)</span>
                          <input
                            value={form.client_name}
                            onChange={(e) => setForm((s) => ({ ...s, client_name: e.target.value }))}
                            className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#2b6cff]/30"
                            placeholder="Nome"
                          />
                        </label>

                        <label className="flex flex-col gap-2">
                          <span className="text-xs font-semibold tracking-wide text-slate-600">Endereço</span>
                          <div className="relative">
                            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                              value={form.address}
                              onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))}
                              className="h-11 w-full rounded-xl bg-white pl-10 pr-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#2b6cff]/30"
                              placeholder="Rua / número"
                              required
                            />
                          </div>
                        </label>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <label className="flex flex-col gap-2">
                            <span className="text-xs font-semibold tracking-wide text-slate-600">Bairro</span>
                            <input
                              value={form.neighborhood}
                              onChange={(e) => setForm((s) => ({ ...s, neighborhood: e.target.value }))}
                              className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#2b6cff]/30"
                              placeholder="Bairro"
                            />
                          </label>
                          <label className="flex flex-col gap-2">
                            <span className="text-xs font-semibold tracking-wide text-slate-600">Cidade</span>
                            <input
                              value={form.city}
                              onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
                              className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#2b6cff]/30"
                              placeholder="Cidade"
                            />
                          </label>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <label className="flex flex-col gap-2">
                            <span className="text-xs font-semibold tracking-wide text-slate-600">Agendamento</span>
                            <div className="relative">
                              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                              <input
                                type="datetime-local"
                                value={form.scheduled_at}
                                onChange={(e) => setForm((s) => ({ ...s, scheduled_at: e.target.value }))}
                                className="h-11 w-full rounded-xl bg-white pl-10 pr-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#2b6cff]/30"
                              />
                            </div>
                          </label>

                          <label className="flex flex-col gap-2">
                            <span className="text-xs font-semibold tracking-wide text-slate-600">Metragem (m²)</span>
                            <input
                              value={form.area_m2}
                              onChange={(e) => setForm((s) => ({ ...s, area_m2: e.target.value }))}
                              className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#2b6cff]/30"
                              placeholder="0"
                              inputMode="decimal"
                            />
                          </label>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <label className="flex flex-col gap-2">
                            <span className="text-xs font-semibold tracking-wide text-slate-600">Valor sugerido</span>
                            <input
                              value={form.suggested_price}
                              onChange={(e) =>
                                setForm((s) => ({ ...s, suggested_price: formatBRLInput(e.target.value) }))
                              }
                              className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#2b6cff]/30"
                              placeholder="R$ 0,00"
                              inputMode="decimal"
                            />
                          </label>
                          <label className="flex flex-col gap-2">
                            <span className="text-xs font-semibold tracking-wide text-slate-600">Valor justo (auto)</span>
                            <input
                              value={form.fair_market_value}
                              onChange={() => null}
                              readOnly
                              className="h-11 rounded-xl bg-slate-50 px-4 text-sm font-semibold text-emerald-700 ring-1 ring-slate-200/70 outline-none"
                              placeholder="-"
                            />
                          </label>
                        </div>

                        <label className="flex flex-col gap-2">
                          <span className="text-xs font-semibold tracking-wide text-slate-600">Estado / conservação</span>
                          <select
                            value={form.condition}
                            onChange={(e) => setForm((s) => ({ ...s, condition: e.target.value }))}
                            className="h-11 rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#2b6cff]/30"
                          >
                            <option value="">Selecionar</option>
                            <option value="Novo">Novo</option>
                            <option value="Entre e Regular">Entre e Regular</option>
                            <option value="Reparos Simples">Reparos Simples</option>
                            <option value="Reparos Importantes">Reparos Importantes</option>
                          </select>
                        </label>
                      </>
                    ) : null}

                    {activeTab === "paradigmas" ? (
                      <>
                        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">Imóveis paradigma</div>
                              <div className="mt-1 text-xs text-slate-500">Comparativos para MCDM (preço/m² ponderado)</div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setForm((s) => ({
                                  ...s,
                                  paradigms: [
                                    ...s.paradigms,
                                    {
                                      id: crypto.randomUUID(),
                                      label: `Paradigma ${s.paradigms.length + 1}`,
                                      area_m2: "",
                                      price: "",
                                      weight: "1",
                                    },
                                  ],
                                }))
                              }
                              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50"
                            >
                              <Plus className="h-4 w-4" />
                              Adicionar
                            </button>
                          </div>

                          <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
                            <div className="flex flex-col gap-1">
                              <div className="text-sm font-semibold text-slate-900">Calculadora MCDM (NBR 14653)</div>
                              <div className="text-xs text-slate-600">
                                Insira <span className="font-semibold">3 amostras</span> (primeiros 3 paradigmas). O sistema calcula a média de R$/m² e aplica tolerância de 20%.
                              </div>
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/70">
                                <div className="text-[11px] font-semibold tracking-[0.16em] text-slate-500">R$/m² MÉDIO</div>
                                <div className="mt-2 text-lg font-semibold text-slate-900">
                                  {mcdmTolerance.ppm2_avg != null ? formatCurrencyBRL(mcdmTolerance.ppm2_avg) : "-"}
                                </div>
                                <div className="mt-1 text-xs font-semibold text-slate-500">Base: 3 amostras válidas</div>
                              </div>
                              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/70">
                                <div className="text-[11px] font-semibold tracking-[0.16em] text-slate-500">INTERVALO -20%</div>
                                <div className="mt-2 text-lg font-semibold text-slate-900">
                                  {mcdmTolerance.ppm2_min != null ? formatCurrencyBRL(mcdmTolerance.ppm2_min) : "-"}
                                </div>
                                <div className="mt-1 text-xs font-semibold text-slate-500">NBR 14653</div>
                              </div>
                              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/70">
                                <div className="text-[11px] font-semibold tracking-[0.16em] text-slate-500">INTERVALO +20%</div>
                                <div className="mt-2 text-lg font-semibold text-slate-900">
                                  {mcdmTolerance.ppm2_max != null ? formatCurrencyBRL(mcdmTolerance.ppm2_max) : "-"}
                                </div>
                                <div className="mt-1 text-xs font-semibold text-slate-500">NBR 14653</div>
                              </div>
                            </div>

                            {mcdmTolerance.used !== 3 ? (
                              <div className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900 ring-1 ring-amber-200/70">
                                Preencha área e preço dos <span className="font-bold">3 primeiros</span> paradigmas para liberar o cálculo normativo.
                              </div>
                            ) : null}
                          </div>

                          <div className="mt-4 grid gap-3">
                            {form.paradigms.map((p, idx) => (
                              <div key={p.id} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
                                <div className="flex items-center justify-between gap-3">
                                  <input
                                    value={p.label}
                                    onChange={(e) =>
                                      setForm((s) => ({
                                        ...s,
                                        paradigms: s.paradigms.map((x) =>
                                          x.id === p.id ? { ...x, label: e.target.value } : x,
                                        ),
                                      }))
                                    }
                                    className="h-10 w-full rounded-xl bg-white px-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#2b6cff]/20"
                                    placeholder={`Paradigma ${idx + 1}`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setForm((s) => ({
                                        ...s,
                                        paradigms: s.paradigms.length > 1 ? s.paradigms.filter((x) => x.id !== p.id) : s.paradigms,
                                      }))
                                    }
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 ring-1 ring-slate-200/70 transition-all hover:bg-slate-50"
                                    aria-label="Remover paradigma"
                                    title="Remover"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>

                                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                                  <label className="flex flex-col gap-2">
                                    <span className="text-[11px] font-semibold tracking-wide text-slate-500">Área (m²)</span>
                                    <input
                                      value={p.area_m2}
                                      onChange={(e) =>
                                        setForm((s) => ({
                                          ...s,
                                          paradigms: s.paradigms.map((x) =>
                                            x.id === p.id ? { ...x, area_m2: e.target.value } : x,
                                          ),
                                        }))
                                      }
                                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#2b6cff]/20"
                                      inputMode="decimal"
                                      placeholder="0"
                                    />
                                  </label>
                                  <label className="flex flex-col gap-2">
                                    <span className="text-[11px] font-semibold tracking-wide text-slate-500">Preço (R$)</span>
                                    <input
                                      value={p.price}
                                      onChange={(e) =>
                                        setForm((s) => ({
                                          ...s,
                                          paradigms: s.paradigms.map((x) =>
                                            x.id === p.id ? { ...x, price: formatBRLInput(e.target.value) } : x,
                                          ),
                                        }))
                                      }
                                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#2b6cff]/20"
                                      inputMode="decimal"
                                      placeholder="R$ 0,00"
                                    />
                                  </label>
                                  <label className="flex flex-col gap-2">
                                    <span className="text-[11px] font-semibold tracking-wide text-slate-500">Peso</span>
                                    <input
                                      value={p.weight}
                                      onChange={(e) =>
                                        setForm((s) => ({
                                          ...s,
                                          paradigms: s.paradigms.map((x) =>
                                            x.id === p.id ? { ...x, weight: e.target.value } : x,
                                          ),
                                        }))
                                      }
                                      className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#2b6cff]/20"
                                      inputMode="decimal"
                                      placeholder="1"
                                    />
                                  </label>
                                </div>
                              </div>
                            ))}
                          </div>

                          {ptamText ? (
                            <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
                              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                <div>
                                  <div className="text-sm font-semibold text-slate-900">Resumo PTAM (prévia)</div>
                                  <div className="mt-1 text-xs text-slate-600">Copie e use no seu modelo oficial.</div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void navigator.clipboard.writeText(ptamText)}
                                  className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition-all hover:bg-slate-800"
                                >
                                  Copiar
                                </button>
                              </div>
                              <textarea
                                value={ptamText}
                                readOnly
                                className="mt-3 min-h-56 w-full rounded-xl bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none"
                              />
                            </div>
                          ) : null}
                        </div>
                      </>
                    ) : null}

                    {activeTab === "fatores" ? (
                      <>
                        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
                          <div className="text-sm font-semibold text-slate-900">Fatores de Homogeneização</div>
                          <div className="mt-1 text-xs text-slate-500">Ex: Conservação 0.90 a 1.10</div>

                          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                            <label className="flex flex-col gap-2">
                              <span className="text-xs font-semibold tracking-wide text-slate-600">Conservação</span>
                              <input
                                value={form.factors.conservation}
                                onChange={(e) =>
                                  setForm((s) => ({
                                    ...s,
                                    factors: { ...s.factors, conservation: e.target.value },
                                  }))
                                }
                                className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#2b6cff]/30"
                                inputMode="decimal"
                                placeholder="1.00"
                              />
                            </label>
                            <label className="flex flex-col gap-2">
                              <span className="text-xs font-semibold tracking-wide text-slate-600">Localização</span>
                              <input
                                value={form.factors.location}
                                onChange={(e) =>
                                  setForm((s) => ({
                                    ...s,
                                    factors: { ...s.factors, location: e.target.value },
                                  }))
                                }
                                className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#2b6cff]/30"
                                inputMode="decimal"
                                placeholder="1.00"
                              />
                            </label>
                            <label className="flex flex-col gap-2">
                              <span className="text-xs font-semibold tracking-wide text-slate-600">Padrão</span>
                              <input
                                value={form.factors.standard}
                                onChange={(e) =>
                                  setForm((s) => ({
                                    ...s,
                                    factors: { ...s.factors, standard: e.target.value },
                                  }))
                                }
                                className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#2b6cff]/30"
                                inputMode="decimal"
                                placeholder="1.00"
                              />
                            </label>
                          </div>
                        </div>
                      </>
                    ) : null}

                    {activeTab === "midia" ? (
                      <>
                        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">Relatório fotográfico</div>
                              <div className="mt-1 text-xs text-slate-500">Upload vinculado à data de vistoria</div>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                            <label className="flex flex-col gap-2">
                              <span className="text-xs font-semibold tracking-wide text-slate-600">Selecionar fotos</span>
                              <input
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={(e) => setSelectedFiles(Array.from(e.target.files ?? []))}
                                className="h-11 rounded-xl bg-white px-4 text-sm text-slate-700 ring-1 ring-slate-200/70 outline-none"
                              />
                            </label>
                            <div className="flex flex-col gap-2">
                              <span className="text-xs font-semibold tracking-wide text-slate-600">Ação</span>
                              <button
                                type="button"
                                onClick={() => void uploadInspectionPhotos()}
                                disabled={uploadingPhotos || selectedFiles.length === 0}
                                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <Camera className="h-4 w-4" />
                                {uploadingPhotos ? "Enviando..." : "Enviar"}
                              </button>
                            </div>
                          </div>

                          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                            {form.photos_urls.length ? (
                              form.photos_urls.slice(0, 12).map((u) => (
                                <a
                                  key={u}
                                  href={u}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="group relative overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200/70"
                                  title="Abrir"
                                >
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={u} alt="" className="h-28 w-full object-cover transition-all duration-300 group-hover:scale-[1.03]" />
                                </a>
                              ))
                            ) : (
                              <div className="col-span-2 rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-600 ring-1 ring-slate-200/70 md:col-span-4">
                                Nenhuma foto vinculada.
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    ) : null}

                    {activeTab === "status" ? (
                      <>
                        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
                          <div className="text-sm font-semibold text-slate-900">Status / Publicação</div>

                          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                            <label className="flex flex-col gap-2">
                              <span className="text-xs font-semibold tracking-wide text-slate-600">Etapa</span>
                              <select
                                value={form.status}
                                onChange={(e) => {
                                  const next = e.target.value as AppraisalStatus;
                                  if (next === "entregue" && !legalDocsOk) {
                                    setErrorMessage(
                                      "Trava jurídica: para finalizar (Entregue/Laudo finalizado), envie Matrícula e IPTU e marque ambos como Conferidos.",
                                    );
                                    return;
                                  }
                                  setForm((s) => ({ ...s, status: next }));
                                }}
                                className="h-11 rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#2b6cff]/30"
                              >
                                <option value="solicitada">Solicitada</option>
                                <option value="vistoria_agendada">Vistoria Agendada</option>
                                <option value="em_elaboracao">Em Elaboração</option>
                                <option value="entregue">Entregue</option>
                              </select>
                            </label>

                            <label className="flex flex-col gap-2">
                              <span className="text-xs font-semibold tracking-wide text-slate-600">Link de vídeo-chamada</span>
                              <div className="relative">
                                <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                  value={form.video_call_link}
                                  onChange={(e) => setForm((s) => ({ ...s, video_call_link: e.target.value }))}
                                  className="h-11 w-full rounded-xl bg-white pl-10 pr-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#2b6cff]/30"
                                  placeholder="https://meet..."
                                />
                              </div>
                            </label>
                          </div>

                          <label className="mt-4 flex flex-col gap-2">
                            <span className="text-xs font-semibold tracking-wide text-slate-600">Observações técnicas</span>
                            <textarea
                              value={form.notes}
                              onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                              className="min-h-28 rounded-xl bg-white px-4 py-3 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#2b6cff]/30"
                              placeholder="Notas técnicas"
                            />
                          </label>

                          <div className="mt-5 flex flex-wrap items-center gap-2">
                            {selectedRow ? (
                              <button
                                type="button"
                                onClick={() => exportPdf(selectedRow)}
                                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:bg-slate-800"
                              >
                                <FileDown className="h-4 w-4" />
                                Exportar PDF
                              </button>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => generatePtamSummary()}
                              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50"
                            >
                              <FileDown className="h-4 w-4" />
                              Gerar PTAM
                            </button>

                            {selectedRow ? (
                              <button
                                type="button"
                                onClick={() => void publishToCatalog(selectedRow)}
                                disabled={publishingId === selectedRow.id || !!selectedRow.published_property_id}
                                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2b6cff] px-5 text-sm font-semibold text-white shadow-[0_10px_26px_-18px_rgba(43,108,255,0.85)] transition-all duration-300 hover:bg-[#255fe6] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <Send className="h-4 w-4" />
                                {selectedRow.published_property_id
                                  ? "Publicado"
                                  : publishingId === selectedRow.id
                                    ? "Publicando..."
                                    : "Publicar no catálogo"}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </>
                    ) : null}
                  </form>
                </div>
              </div>

              </div>

              <div className="border-t border-slate-100 bg-white px-6 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (isSaving || uploadingPhotos) return;
                      setIsModalOpen(false);
                      resetForm();
                    }}
                    disabled={isSaving || uploadingPhotos}
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-100 px-6 text-sm font-semibold text-slate-800 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-200/60 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    form="appraisal-form"
                    disabled={isSaving || uploadingPhotos}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2b6cff] px-6 text-sm font-semibold text-white shadow-[0_10px_26px_-18px_rgba(43,108,255,0.85)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#255fe6] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Plus className="h-4 w-4" />
                    {isSaving ? "Salvando..." : selectedId ? "Salvar alterações" : "Criar avaliação"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
