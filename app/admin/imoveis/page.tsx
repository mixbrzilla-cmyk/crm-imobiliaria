"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  BedDouble,
  Building2,
  Camera,
  CarFront,
  CheckCircle2,
  ClipboardList,
  Crown,
  Cuboid,
  FileText,
  FileDown,
  Home,
  Layers,
  Loader2,
  Link as LinkIcon,
  MapPin,
  MessageCircle,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Ruler,
  SlidersHorizontal,
  Share2,
  Trash2,
  BadgeCheck,
  Search,
  Tag,
  Users,
  X,
} from "lucide-react";

import { getSupabaseClient } from "@/lib/supabaseClient";
import { formatBRLInput, formatCurrencyBRL, parseBRLInputToNumber } from "@/lib/brl";

type PropertyStatus =
  | "rascunho"
  | "disponivel"
  | "reservado"
  | "vendido"
  | "alugado"
  | "inativo";

type PropertyPurpose = "venda" | "locacao";

type PropertyRow = {
  id: string;
  title: string | null;
  property_type: string | null;
  purpose: PropertyPurpose | null;
  price: number | null;
  is_premium?: boolean | null;
  corretor_id?: string | null;
  broker_id?: string | null;
  data_direcionamento?: string | null;
  neighborhood: string | null;
  city: string | null;
  owner_whatsapp?: string | null;
  last_owner_contact_at?: string | null;
  bedrooms: number | null;
  suites: number | null;
  bathrooms: number | null;
  parking_spots: number | null;
  area_m2: number | null;
  photos_urls: string[] | null;
  tour_url: string | null;
  status: PropertyStatus | null;
  description: string | null;
  portals_json?: any;
  portal_status_json?: any;
  portais_json?: any;
  portais_status_json?: any;
  integrations_json?: any;
  created_at?: string;
};

type FormState = {
  title: string;
  property_type: string;
  purpose: PropertyPurpose;
  price: string;
  commission_percent: string;
  neighborhood: string;
  city: string;
  owner_whatsapp: string;
  corretor_id: string;
  is_premium: boolean;
  bedrooms: string;
  suites: string;
  bathrooms: string;
  parking_spots: string;
  area_m2: string;
  photos_urls: string;
  tour_url: string;
  status: PropertyStatus;
  description: string;
};

const statusLabel: Record<PropertyStatus, string> = {
  rascunho: "Rascunho",
  disponivel: "Disponível",
  reservado: "Reservado",
  vendido: "Vendido",
  alugado: "Alugado",
  inativo: "Inativo",
};

function parseOptionalInt(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function formatTimeBR(value: string | null) {
  if (!value) return "-";
  try {
    const d = new Date(value);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function Badge({ status }: { status: PropertyStatus }) {
  const cls =
    status === "disponivel"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200/70"
      : status === "reservado"
        ? "bg-amber-50 text-amber-700 ring-amber-200/70"
        : status === "vendido" || status === "alugado"
          ? "bg-slate-100 text-slate-700 ring-slate-200/70"
          : status === "inativo"
            ? "bg-rose-50 text-rose-700 ring-rose-200/70"
            : "bg-slate-50 text-slate-600 ring-slate-200/70";

  return (
    <span
      className={
        "inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 " +
        cls
      }
    >
      {statusLabel[status]}
    </span>
  );
}

type TabKey = "basicos" | "caracteristicas" | "midia" | "status";

type BrokerProfile = {
  id: string;
  full_name: string | null;
  status: string | null;
  status_aprovacao?: string | null;
  role?: string | null;
};

type ExpenseLine = {
  source: "materials" | "labor" | "marketing" | "vehicle";
  id: string;
  date: string | null;
  category: string | null;
  description: string | null;
  amount: number;
  done: boolean;
};

export default function InventarioImoveisPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [propertiesBrokerColumn, setPropertiesBrokerColumn] = useState<"corretor_id" | "broker_id">("corretor_id");
  const [supportsAssignedBrokerId, setSupportsAssignedBrokerId] = useState(false);

  const [activeTab, setActiveTab] = useState<TabKey>("basicos");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [purposeFilter, setPurposeFilter] = useState<"all" | PropertyPurpose>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | PropertyStatus>("all");

  const [rows, setRows] = useState<PropertyRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const portalColumns = useMemo(
    () => ["portals_json", "portal_status_json", "portais_json", "portais_status_json", "integrations_json"] as const,
    [],
  );
  const [portalColumn, setPortalColumn] = useState<string | null>(null);
  const [portalSyncByKey, setPortalSyncByKey] = useState<Record<string, boolean>>({});

  const [commissionColumn, setCommissionColumn] = useState<string | null>(null);
  const [expenseLines, setExpenseLines] = useState<ExpenseLine[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(false);

  const expenseSourceLabel = useCallback((source: ExpenseLine["source"]) => {
    if (source === "materials") return "Insumos e Materiais";
    if (source === "labor") return "Mão de Obra e Reformas";
    if (source === "marketing") return "Investimento em Marketing";
    return "Deslocamento e Veículos";
  }, []);

  function safeDateBR(date: string | null) {
    if (!date) return "-";
    try {
      return new Date(date).toLocaleDateString("pt-BR");
    } catch {
      return String(date);
    }
  }

  function buildReportHtml(args: {
    propertyTitle: string;
    propertyRef: string;
    propertyLocal: string;
    lines: ExpenseLine[];
  }) {
    const total = args.lines.reduce((acc, l) => acc + (Number(l.amount ?? 0) || 0), 0);
    const pending = args.lines.filter((l) => !l.done).length;
    const status = args.lines.length > 0 && pending === 0 ? "Entregue" : "Pendente";

    const rows = args.lines
      .slice()
      .sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")))
      .map((l) => {
        const item = (l.description ?? "").trim() || l.category || "-";
        const st = l.done ? "Entregue" : "Pendente";
        return `
          <tr>
            <td>${safeDateBR(l.date)}</td>
            <td>${item.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>
            <td class="right">${formatCurrencyBRL(Number(l.amount ?? 0) || 0)}</td>
            <td class="right"><span class="pill ${l.done ? "done" : "pending"}">${st}</span></td>
          </tr>
        `;
      })
      .join("\n");

    const now = new Date().toLocaleString("pt-BR");
    return `
<!doctype html>
<html lang="pt-br">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Relatório de Gastos do Imóvel</title>
    <style>
      :root { color-scheme: light; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 0; background: #f1f5f9; color: #0f172a; }
      .page { max-width: 980px; margin: 24px auto; padding: 24px; background: #fff; border: 1px solid #e2e8f0; border-radius: 18px; }
      .top { display:flex; justify-content: space-between; gap: 16px; align-items: center; }
      .brand { display:flex; gap: 12px; align-items:center; }
      .logo { width: 56px; height: 56px; border-radius: 16px; background: linear-gradient(135deg,#2b6cff,#001f3f); display:flex; align-items:center; justify-content:center; color:#fff; font-weight: 800; }
      .h1 { font-size: 20px; font-weight: 800; margin: 0; }
      .meta { font-size: 12px; color: #475569; font-weight: 600; margin-top: 2px; }
      .printbar { display:flex; gap: 10px; }
      .btn { border: 1px solid #e2e8f0; background: #fff; padding: 10px 12px; border-radius: 14px; font-weight: 700; font-size: 12px; cursor:pointer; }
      .btn.primary { background: #2b6cff; border-color: #2b6cff; color: #fff; }
      .section { margin-top: 18px; padding-top: 18px; border-top: 1px solid #e2e8f0; }
      .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      .card { background:#f8fafc; border:1px solid #e2e8f0; border-radius: 16px; padding: 14px; }
      .label { font-size: 10px; letter-spacing: .18em; font-weight: 800; color: #64748b; }
      .value { margin-top: 6px; font-size: 13px; font-weight: 800; color:#0f172a; }
      table { width:100%; border-collapse: separate; border-spacing: 0; margin-top: 10px; overflow: hidden; border: 1px solid #e2e8f0; border-radius: 14px; }
      thead th { background: #f8fafc; font-size: 11px; text-transform: none; letter-spacing: .06em; color:#334155; padding: 10px 12px; text-align:left; border-bottom: 1px solid #e2e8f0; }
      tbody td { padding: 10px 12px; font-size: 12px; color:#0f172a; border-bottom: 1px solid #f1f5f9; }
      tbody tr:last-child td { border-bottom: none; }
      .right { text-align:right; }
      .pill { display:inline-block; padding: 6px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; border:1px solid transparent; }
      .pill.done { background:#ecfdf5; color:#065f46; border-color:#a7f3d0; }
      .pill.pending { background:#fff7ed; color:#9a3412; border-color:#fed7aa; }
      .footer { margin-top: 12px; font-size: 11px; color:#64748b; font-weight: 600; }
      @media print { body { background:#fff; } .page { margin:0; border:none; border-radius:0; } .printbar { display:none; } }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="top">
        <div class="brand">
          <div class="logo">LOGO</div>
          <div>
            <p class="h1">Relatório de Gastos do Imóvel</p>
            <div class="meta">Gerado em ${now}</div>
          </div>
        </div>
        <div class="printbar">
          <button class="btn" onclick="window.print()">Imprimir / Salvar PDF</button>
          <button class="btn primary" onclick="window.close()">Fechar</button>
        </div>
      </div>

      <div class="section">
        <div class="grid">
          <div class="card">
            <div class="label">IMÓVEL</div>
            <div class="value">${args.propertyTitle.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
            <div class="meta">${args.propertyLocal.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
          </div>
          <div class="card">
            <div class="label">REFERÊNCIA</div>
            <div class="value">${args.propertyRef.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
            <div class="meta">Status geral: <strong>${status}</strong> (${pending} pendente)</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="label">DETALHAMENTO DE GASTOS</div>
        <table>
          <thead>
            <tr>
              <th style="width: 140px;">Data</th>
              <th>Item</th>
              <th style="width: 160px;" class="right">Valor</th>
              <th style="width: 150px;" class="right">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="4">Nenhum gasto vinculado.</td></tr>`}
          </tbody>
        </table>

        <div class="section" style="border-top:none; padding-top: 0;">
          <div class="grid">
            <div class="card">
              <div class="label">TOTAL GASTO</div>
              <div class="value">${formatCurrencyBRL(total)}</div>
            </div>
            <div class="card">
              <div class="label">STATUS FINAL</div>
              <div class="value">${status}</div>
              <div class="meta">Entregue = todos os itens concluídos</div>
            </div>
          </div>
        </div>

        <div class="footer">Observação: este relatório lista despesas vinculadas ao imóvel via lançamentos do sistema.</div>
      </div>
    </div>
  </body>
</html>
    `.trim();
  }

  async function openTransparencyReport(args: {
    propertyId: string;
    propertyTitle: string;
    propertyLocal: string;
    lines?: ExpenseLine[];
  }) {
    let lines = args.lines;
    if (!lines) {
      const res = await fetch(`/api/property-expenses?propertyId=${encodeURIComponent(args.propertyId)}`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(String(json?.error ?? `Falha ao carregar gastos (HTTP ${res.status})`));
      lines = (json.lines ?? []) as ExpenseLine[];
    }

    const html = buildReportHtml({
      propertyTitle: args.propertyTitle,
      propertyRef: `ID: ${args.propertyId}`,
      propertyLocal: args.propertyLocal,
      lines,
    });

    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) {
      setErrorMessage("O navegador bloqueou o pop-up do relatório. Permita pop-ups para gerar o PDF.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
  }

  function openWhatsappWithTransparencyText(phoneRaw: string, propertyTitle: string) {
    const phone = String(phoneRaw ?? "").replace(/\D+/g, "");
    if (!phone) {
      setErrorMessage("Preencha o WhatsApp do proprietário para enviar a mensagem.");
      return;
    }

    const total = expenseLines.reduce((acc, l) => acc + (Number(l.amount ?? 0) || 0), 0);
    const pending = expenseLines.filter((l) => !l.done).length;
    const status = expenseLines.length > 0 && pending === 0 ? "Entregue" : "Pendente";
    const text =
      `Olá, segue o extrato de gastos do seu imóvel (${propertyTitle}). ` +
      `Total gasto: ${formatCurrencyBRL(total)}. Status: ${status}. ` +
      `Vou anexar o PDF/imagem do relatório na sequência.`;
    const url = `https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 8000);
  }, []);

  const getPortalValue = useCallback(
    (row: any, key: "olx" | "zap" | "vivareal") => {
      const col = portalColumn;
      if (!col) return false;
      const raw = row?.[col];
      if (!raw) return false;
      if (typeof raw === "object") return Boolean(raw?.[key]);
      if (typeof raw === "string") {
        try {
          const obj = JSON.parse(raw);
          return Boolean(obj?.[key]);
        } catch {
          return false;
        }
      }
      return false;
    },
    [portalColumn],
  );

  const setPortalValueLocal = useCallback(
    (propertyId: string, key: "olx" | "zap" | "vivareal", value: boolean) => {
      const col = portalColumn;
      if (!col) return;
      setRows((current) =>
        current.map((r: any) => {
          if (r.id !== propertyId) return r;
          const raw = r?.[col];
          let obj: any = {};
          if (raw && typeof raw === "object") obj = { ...raw };
          if (raw && typeof raw === "string") {
            try {
              obj = { ...(JSON.parse(raw) ?? {}) };
            } catch {
              obj = {};
            }
          }
          obj[key] = value;
          return { ...r, [col]: obj };
        }),
      );
    },
    [portalColumn],
  );

  const togglePortal = useCallback(
    async (propertyId: string, portal: "olx" | "zap" | "vivareal") => {
      if (!portalColumn) {
        showToast("Configure uma coluna JSONB (ex: portals_json) para armazenar status nos portais.");
        return;
      }

      const row = rows.find((r) => r.id === propertyId) as any;
      const current = getPortalValue(row, portal);
      const next = !current;
      const k = `${propertyId}:${portal}`;

      setPortalValueLocal(propertyId, portal, next);
      setPortalSyncByKey((s) => ({ ...s, [k]: true }));

      try {
        const res = await fetch("/api/portais-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityType: "property", id: propertyId, portal, value: next }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          const msg = String(json?.error ?? `Falha ao salvar (HTTP ${res.status})`);
          showToast(msg);
          setPortalValueLocal(propertyId, portal, current);
          return;
        }
        showToast("Status nos portais atualizado.");
      } catch (e: any) {
        showToast(e?.message ?? "Falha ao salvar status nos portais.");
        setPortalValueLocal(propertyId, portal, current);
      } finally {
        setPortalSyncByKey((s) => {
          const copy = { ...s };
          delete copy[k];
          return copy;
        });
      }
    },
    [portalColumn, rows, getPortalValue, setPortalValueLocal, showToast],
  );

  async function detectPortalColumn() {
    if (!supabase) return null;
    for (const col of portalColumns) {
      try {
        const res = await (supabase as any).from("properties").select(`id, ${col}`).limit(1);
        if (!res?.error) return col;
        const msg = String(res.error?.message ?? "");
        const code = (res.error as any)?.code;
        const isSchemaMismatch = code === "PGRST204" || code === "PGRST301";
        const isMissing = /does not exist|not found|column/i.test(msg);
        if (isSchemaMismatch || isMissing) continue;
      } catch {
        continue;
      }
    }
    return null;
  }

  async function detectCommissionColumn() {
    if (!supabase) return null;
    const candidates = ["commission_percent", "commission_percentage", "commission_rate"];
    for (const col of candidates) {
      try {
        const res = await (supabase as any).from("properties").select(`id, ${col}`).limit(1);
        if (!res?.error) return col;
        const msg = String(res.error?.message ?? "");
        const code = (res.error as any)?.code;
        const isSchemaMismatch = code === "PGRST204" || code === "PGRST301";
        const isMissing = /does not exist|not found|column/i.test(msg);
        if (isSchemaMismatch || isMissing) continue;
      } catch {
        continue;
      }
    }
    return null;
  }

  async function loadLinkedExpenses(propertyId: string) {
    setExpensesLoading(true);
    try {
      const res = await fetch(`/api/property-expenses?propertyId=${encodeURIComponent(propertyId)}`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setExpenseLines([]);
        return;
      }
      setExpenseLines((json.lines ?? []) as ExpenseLine[]);
    } catch {
      setExpenseLines([]);
    } finally {
      setExpensesLoading(false);
    }
  }

  async function concludeExpense(line: ExpenseLine) {
    if (!selectedId) return;
    const ok = window.confirm("Marcar este lançamento como concluído/entregue?");
    if (!ok) return;

    setExpenseLines((cur) => cur.map((l) => (l.source === line.source && l.id === line.id ? { ...l, done: true } : l)));

    try {
      const res = await fetch("/api/property-expenses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: line.source, id: line.id }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setErrorMessage(String(json?.error ?? `Falha ao concluir (HTTP ${res.status})`));
        await loadLinkedExpenses(selectedId);
      }
    } catch {
      setErrorMessage("Não foi possível concluir o lançamento agora.");
      await loadLinkedExpenses(selectedId);
    }
  }

  async function deleteExpenseLine(line: ExpenseLine) {
    if (!selectedId) return;
    const ok = window.confirm("Tem certeza que deseja apagar este lançamento?");
    if (!ok) return;

    const prev = expenseLines;
    setExpenseLines((cur) => cur.filter((l) => !(l.source === line.source && l.id === line.id)));

    try {
      const res = await fetch("/api/property-expenses", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: line.source, id: line.id }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setExpenseLines(prev);
        setErrorMessage(String(json?.error ?? `Falha ao excluir (HTTP ${res.status})`));
      }
    } catch {
      setExpenseLines(prev);
      setErrorMessage("Não foi possível excluir o lançamento agora.");
    }
  }

  const [updatingFieldByRowId, setUpdatingFieldByRowId] = useState<Record<string, "corretor" | "premium" | null>>(
    {},
  );

  const [brokers, setBrokers] = useState<BrokerProfile[]>([]);

  const [form, setForm] = useState<FormState>({
    title: "",
    property_type: "Apartamento",
    purpose: "venda",
    price: "",
    commission_percent: "",
    neighborhood: "",
    city: "",
    owner_whatsapp: "",
    corretor_id: "",
    is_premium: false,
    bedrooms: "",
    suites: "",
    bathrooms: "",
    parking_spots: "",
    area_m2: "",
    photos_urls: "",
    tour_url: "",
    status: "disponivel",
    description: "",
  });

  async function load() {
    setErrorMessage(null);

    if (!supabase) {
      setRows([]);
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    try {
      const detectedPortalCol = portalColumn ?? (await detectPortalColumn());
      if (portalColumn == null) setPortalColumn(detectedPortalCol);

      const detectedCommissionCol = commissionColumn ?? (await detectCommissionColumn());
      if (commissionColumn == null) setCommissionColumn(detectedCommissionCol);

      const brokerCol = propertiesBrokerColumn;
      const portalsSelect = detectedPortalCol ? `, ${detectedPortalCol}` : "";
      const commSelect = detectedCommissionCol ? `, ${detectedCommissionCol}` : "";
      const baseSelect = `id, title, property_type, purpose, price, is_premium, ${brokerCol}, data_direcionamento, owner_whatsapp, last_owner_contact_at, neighborhood, city, bedrooms, suites, bathrooms, parking_spots, area_m2, photos_urls, tour_url, status, description${portalsSelect}${commSelect}, created_at`;
      const selectStr = supportsAssignedBrokerId ? `${baseSelect}, assigned_broker_id` : baseSelect;
      const { data, error } = await supabase
        .from("properties")
        .select(
          selectStr,
        )
        .order("created_at", { ascending: false });

      if (error) {
        setRows([]);
        setErrorMessage(error.message);
        return;
      }

      setRows((data ?? []) as any);
    } catch {
      try {
        const detectedPortalCol = portalColumn ?? (await detectPortalColumn());
        if (portalColumn == null) setPortalColumn(detectedPortalCol);

        const detectedCommissionCol = commissionColumn ?? (await detectCommissionColumn());
        if (commissionColumn == null) setCommissionColumn(detectedCommissionCol);

        const brokerCol = propertiesBrokerColumn;
        const portalsSelect = detectedPortalCol ? `, ${detectedPortalCol}` : "";
        const commSelect = detectedCommissionCol ? `, ${detectedCommissionCol}` : "";
        const baseSelect = `id, title, property_type, purpose, price, is_premium, ${brokerCol}, owner_whatsapp, last_owner_contact_at, neighborhood, city, bedrooms, suites, bathrooms, parking_spots, area_m2, photos_urls, tour_url, status, description${portalsSelect}${commSelect}, created_at`;
        const selectStr = supportsAssignedBrokerId ? `${baseSelect}, assigned_broker_id` : baseSelect;
        const { data, error } = await supabase
          .from("properties")
          .select(
            selectStr,
          )
          .order("created_at", { ascending: false });
        if (error) {
          setRows([]);
          setErrorMessage(error.message);
          return;
        }
        setRows((data ?? []) as any);
      } catch {
        setRows([]);
        setErrorMessage("Não foi possível carregar o inventário agora.");
      }
    }
  }

  function PortalSwitch({
    label,
    active,
    syncing,
    onToggle,
    brandOnCls,
    brandRingOffCls,
    brandTextOffCls,
  }: {
    label: string;
    active: boolean;
    syncing: boolean;
    onToggle: () => void;
    brandOnCls: string;
    brandRingOffCls: string;
    brandTextOffCls: string;
  }) {
    const cls = active
      ? `${brandOnCls} ring-1 ring-white/20 shadow-[0_14px_34px_-18px_rgba(15,23,42,0.85)]`
      : `bg-white ${brandTextOffCls} ring-1 ${brandRingOffCls} shadow-sm`;

    return (
      <button
        type="button"
        onClick={onToggle}
        disabled={syncing}
        className={
          "group inline-flex items-center justify-between gap-3 rounded-full px-4 py-2.5 text-xs font-semibold tracking-wide transition-all duration-300 hover:-translate-y-[1px] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 disabled:cursor-not-allowed disabled:opacity-80 " +
          (syncing ? "animate-pulse" : "") +
          " " +
          cls +
          (active
            ? ""
            : " hover:bg-slate-50/60")
        }
      >
        <span className="whitespace-nowrap">{label}</span>
        <span className="inline-flex items-center gap-1.5">
          {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          <span className="text-[10px] font-semibold">
            {syncing ? "Sincronizando..." : active ? "Ativo" : "Off"}
          </span>
        </span>
      </button>
    );
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
        .eq("status", "ativo")
        .order("full_name", { ascending: true });

      if (res.error) {
        res = await supabase
          .from("profiles")
          .select("id, full_name, status, role")
          .eq("role", "broker")
          .eq("status", "ativo")
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

  useEffect(() => {
    void load();
    void loadBrokers();
  }, []);

  useEffect(() => {
    if (!supabase) return;

    const timeoutId = window.setTimeout(async () => {
      try {
        try {
          const testAssigned = await (supabase as any).from("properties").select("id, assigned_broker_id").limit(1);
          setSupportsAssignedBrokerId(!testAssigned?.error);
        } catch {
          setSupportsAssignedBrokerId(false);
        }

        const test = await (supabase as any).from("properties").select("id, broker_id").limit(1);
        if (!test.error) {
          setPropertiesBrokerColumn("broker_id");
        } else {
          setPropertiesBrokerColumn("corretor_id");
        }
      } catch {
        setSupportsAssignedBrokerId(false);
        setPropertiesBrokerColumn("corretor_id");
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [supabase]);

  async function updateCorretorInline(rowId: string, brokerId: string) {
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    const nextBrokerId = brokerId || null;
    const nowIso = nextBrokerId ? new Date().toISOString() : null;

    const payloadPrimary: any = supportsAssignedBrokerId
      ? { assigned_broker_id: nextBrokerId, [propertiesBrokerColumn]: nextBrokerId, data_direcionamento: nowIso }
      : { [propertiesBrokerColumn]: nextBrokerId, data_direcionamento: nowIso };
    const payloadFallback: any = { [propertiesBrokerColumn]: nextBrokerId, data_direcionamento: nowIso };
    const payloadAttempts: Array<any> = supportsAssignedBrokerId ? [payloadPrimary, payloadFallback] : [payloadFallback];

    const payload = payloadAttempts[0];
    console.log("[Inventário] Salvando corretor/data_direcionamento", { rowId, payload });

    setUpdatingFieldByRowId((c) => ({ ...c, [rowId]: "corretor" }));
    setRows((current) =>
      current.map((r: any) =>
        r.id === rowId
          ? {
              ...r,
              ...(supportsAssignedBrokerId ? { assigned_broker_id: nextBrokerId } : null),
              [propertiesBrokerColumn]: nextBrokerId,
              data_direcionamento: nowIso,
            }
          : r,
      ),
    );

    try {
      let lastError: any = null;
      for (const attempt of payloadAttempts) {
        const { error } = await (supabase as any).from("properties").update(attempt).eq("id", rowId);
        if (!error) {
          lastError = null;
          break;
        }
        lastError = error;
        const msg = String(error.message ?? "");
        const isAssignedMissing = /assigned_broker_id/i.test(msg) && /does not exist|not found/i.test(msg);
        const code = (error as any)?.code;
        const isSchemaMismatch = code === "PGRST204" || code === "PGRST301";
        if (!isAssignedMissing && !isSchemaMismatch) break;
      }

      if (lastError) {
        console.log("[Inventário] Erro ao salvar corretor/data_direcionamento", { rowId, error: lastError, payload });
        const msg = String(lastError.message ?? "");
        if (msg.toLowerCase().includes("data_direcionamento") && msg.toLowerCase().includes("does not exist")) {
          setErrorMessage(
            'Coluna "data_direcionamento" não existe na tabela properties (ou não está exposta). Crie a coluna (timestamptz) no Supabase e tente novamente.',
          );
        } else if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("rls")) {
          setErrorMessage(
            'Permissão negada ao salvar. Verifique RLS/policies da tabela properties para update desses campos.',
          );
        } else {
          setErrorMessage(msg || "Erro ao salvar.");
        }
        await load();
        return;
      }

      if (nextBrokerId) showToast("Corretor vinculado com sucesso.");
    } catch {
      console.log("[Inventário] Falha inesperada ao salvar corretor/data_direcionamento", { rowId, payload });
      setErrorMessage("Não foi possível salvar o corretor agora.");
      await load();
    } finally {
      setUpdatingFieldByRowId((c) => ({ ...c, [rowId]: null }));
    }
  }

  async function updatePremiumInline(rowId: string, nextValue: boolean) {
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    setUpdatingFieldByRowId((c) => ({ ...c, [rowId]: "premium" }));
    setRows((current) => current.map((r) => (r.id === rowId ? { ...r, is_premium: nextValue } : r)));

    try {
      const { error } = await (supabase as any)
        .from("properties")
        .update({ is_premium: nextValue })
        .eq("id", rowId);

      if (error) {
        setErrorMessage(error.message);
        await load();
        return;
      }
    } catch {
      setErrorMessage("Não foi possível salvar o premium agora.");
      await load();
    } finally {
      setUpdatingFieldByRowId((c) => ({ ...c, [rowId]: null }));
    }
  }

  function resetForm() {
    setSelectedId(null);
    setActiveTab("basicos");
    setExpenseLines([]);
    setForm({
      title: "",
      property_type: "Apartamento",
      purpose: "venda",
      price: "",
      commission_percent: "",
      neighborhood: "",
      city: "",
      owner_whatsapp: "",
      corretor_id: "",
      is_premium: false,
      bedrooms: "",
      suites: "",
      bathrooms: "",
      parking_spots: "",
      area_m2: "",
      photos_urls: "",
      tour_url: "",
      status: "disponivel",
      description: "",
    });
  }

  function editRow(row: PropertyRow) {
    setSelectedId(row.id);
    setActiveTab("basicos");
    void loadLinkedExpenses(row.id);

    const col = commissionColumn;
    const raw = col ? (row as any)?.[col] : null;
    const pctNum = raw != null ? Number(raw) : NaN;
    const pctStr = Number.isFinite(pctNum) ? String(pctNum) : "";
    setForm({
      title: row.title ?? "",
      property_type: row.property_type ?? "Apartamento",
      purpose: (row.purpose ?? "venda") as PropertyPurpose,
      price:
        typeof row.price === "number" ? formatCurrencyBRL(row.price, { maximumFractionDigits: 2 }) : "",
      commission_percent: pctStr,
      neighborhood: row.neighborhood ?? "",
      city: row.city ?? "",
      owner_whatsapp: String(row.owner_whatsapp ?? ""),
      corretor_id: row.corretor_id ?? "",
      is_premium: Boolean(row.is_premium),
      bedrooms: row.bedrooms != null ? String(row.bedrooms) : "",
      suites: row.suites != null ? String(row.suites) : "",
      bathrooms: row.bathrooms != null ? String(row.bathrooms) : "",
      parking_spots: row.parking_spots != null ? String(row.parking_spots) : "",
      area_m2: row.area_m2 != null ? String(row.area_m2) : "",
      photos_urls: (row.photos_urls ?? []).join("\n"),
      tour_url: row.tour_url ?? "",
      status: (row.status ?? "disponivel") as PropertyStatus,
      description: row.description ?? "",
    });

    setIsFormOpen(true);
  }

  function openNew() {
    resetForm();
    setIsFormOpen(true);
  }

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (purposeFilter !== "all" && (r.purpose ?? null) !== purposeFilter) return false;
      if (statusFilter !== "all" && (r.status ?? "disponivel") !== statusFilter) return false;
      if (!q) return true;

      const title = String(r.title ?? "").toLowerCase();
      const neighborhood = String(r.neighborhood ?? "").toLowerCase();
      const city = String(r.city ?? "").toLowerCase();
      const type = String(r.property_type ?? "").toLowerCase();
      return title.includes(q) || neighborhood.includes(q) || city.includes(q) || type.includes(q);
    });
  }, [rows, search, purposeFilter, statusFilter]);

  function purposeLabel(purpose: PropertyPurpose | null) {
    return purpose === "locacao" ? "Aluguel" : "Venda";
  }

  function purposeBadgeCls(purpose: PropertyPurpose | null) {
    return purpose === "locacao"
      ? "bg-sky-50 text-sky-700 ring-sky-200/70"
      : "bg-emerald-50 text-emerald-700 ring-emerald-200/70";
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    setIsSaving(true);

    const photos = form.photos_urls
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const payload = {
      id: selectedId ?? crypto.randomUUID(),
      title: form.title.trim() ? form.title.trim() : null,
      property_type: form.property_type.trim() ? form.property_type.trim() : null,
      purpose: form.purpose,
      price: parseBRLInputToNumber(form.price),
      ...(commissionColumn
        ? { [commissionColumn]: (() => {
            const raw = form.commission_percent.trim();
            if (!raw) return null;
            const n = Number(raw.replace(",", "."));
            return Number.isFinite(n) ? n : null;
          })() }
        : null),
      owner_whatsapp: form.owner_whatsapp.trim() ? form.owner_whatsapp.trim() : null,
      ...(supportsAssignedBrokerId
        ? { assigned_broker_id: form.corretor_id.trim() ? form.corretor_id.trim() : null }
        : null),
      [propertiesBrokerColumn]: form.corretor_id.trim() ? form.corretor_id.trim() : null,
      is_premium: form.is_premium,
      neighborhood: form.neighborhood.trim() ? form.neighborhood.trim() : null,
      city: form.city.trim() ? form.city.trim() : null,
      bedrooms: parseOptionalInt(form.bedrooms),
      suites: parseOptionalInt(form.suites),
      bathrooms: parseOptionalInt(form.bathrooms),
      parking_spots: parseOptionalInt(form.parking_spots),
      area_m2: parseOptionalNumber(form.area_m2),
      photos_urls: photos.length ? photos : null,
      tour_url: form.tour_url.trim() ? form.tour_url.trim() : null,
      status: form.status,
      description: form.description.trim() ? form.description.trim() : null,
    } as any;

    try {
      const query = (supabase as any).from("properties");
      const { error } = selectedId
        ? await query.update(payload).eq("id", selectedId)
        : await query.insert(payload);

      if (error) throw error;

      setIsSaving(false);
      if (form.corretor_id.trim()) showToast("Corretor vinculado com sucesso.");
      resetForm();
      setIsFormOpen(false);
      await load();
    } catch {
      try {
        const retryPayload: any = { ...payload };
        delete retryPayload.assigned_broker_id;
        delete retryPayload[propertiesBrokerColumn];
        const query = (supabase as any).from("properties");
        const { error } = selectedId
          ? await query.update(retryPayload).eq("id", selectedId)
          : await query.insert(retryPayload);

        if (error) {
          setErrorMessage(error.message);
          setIsSaving(false);
          return;
        }

        setIsSaving(false);
        resetForm();
        setIsFormOpen(false);
        await load();
      } catch {
        setIsSaving(false);
        setErrorMessage("Não foi possível salvar o imóvel agora.");
      }
    }
  }

  async function removeRow(id: string) {
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    setIsDeletingId(id);

    try {
      const { error } = await (supabase as any).from("properties").delete().eq("id", id);
      if (error) {
        const code = (error as any)?.code;
        const details = (error as any)?.details;
        const hint = (error as any)?.hint;
        const message = String(error.message ?? "Erro ao excluir.");
        console.error("[Inventário] DELETE properties falhou", { id, code, details, hint, message, error });
        const full = [message, code ? `code=${code}` : null, details ? `details=${details}` : null, hint ? `hint=${hint}` : null]
          .filter(Boolean)
          .join(" | ");
        setErrorMessage(full);
        showToast(full);
        setIsDeletingId(null);
        return;
      }

      setRows((current) => current.filter((r) => r.id !== id));
      if (selectedId === id) resetForm();
      setIsDeletingId(null);
    } catch {
      console.error("[Inventário] DELETE properties falhou (exception)", { id });
      setErrorMessage("Não foi possível excluir o imóvel agora.");
      showToast("Não foi possível excluir o imóvel agora.");
      setIsDeletingId(null);
    }
  }

  const tabs: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
    {
      key: "basicos",
      label: "Básicos",
      icon: <Tag className="h-4 w-4" />,
    },
    {
      key: "caracteristicas",
      label: "Características",
      icon: <Layers className="h-4 w-4" />,
    },
    {
      key: "midia",
      label: "Mídia",
      icon: <Camera className="h-4 w-4" />,
    },
    {
      key: "status",
      label: "Status",
      icon: <BadgeCheck className="h-4 w-4" />,
    },
  ];

  return (
    <div className="min-h-screen w-full bg-slate-100 px-6 py-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      {toastMessage ? (
        <div className="fixed right-6 top-6 z-50 max-w-[520px] rounded-2xl bg-rose-600 px-5 py-4 text-sm font-semibold text-white shadow-[0_16px_40px_-24px_rgba(0,0,0,0.55)]">
          {toastMessage}
        </div>
      ) : null}

      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">INVENTÁRIO</div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Inventário</h1>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
            <div className="relative w-full md:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 w-full rounded-xl bg-slate-50 pl-10 pr-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#2b6cff]/40"
                placeholder="Buscar por título, bairro, cidade..."
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200/70">
                <SlidersHorizontal className="h-4 w-4 text-slate-500" />
                <select
                  value={purposeFilter}
                  onChange={(e) => setPurposeFilter(e.target.value as any)}
                  className="bg-transparent text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value="all">Finalidade: Todas</option>
                  <option value="venda">Finalidade: Venda</option>
                  <option value="locacao">Finalidade: Aluguel</option>
                </select>
              </div>

              <div className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200/70">
                <SlidersHorizontal className="h-4 w-4 text-slate-500" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-transparent text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value="all">Status: Todos</option>
                  <option value="disponivel">Disponível</option>
                  <option value="reservado">Reservado</option>
                  <option value="vendido">Vendido</option>
                  <option value="alugado">Alugado</option>
                  <option value="rascunho">Rascunho</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50"
            >
              Recarregar
            </button>
            <button
              type="button"
              onClick={() => openNew()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2b6cff] px-5 text-sm font-semibold text-white shadow-[0_10px_26px_-18px_rgba(43,108,255,0.85)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#255fe6]"
            >
              <Plus className="h-4 w-4" />
              Novo Imóvel
            </button>
          </div>
        </div>
      </header>

      {errorMessage ? (
        <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200/70">
          {errorMessage}
        </div>
      ) : null}

      <section className="w-full">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">Vitrine de imóveis</div>
            <div className="mt-1 text-xs text-slate-500">{filteredRows.length} registros</div>
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <div className="mt-5 rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200/70">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <Home className="h-7 w-7" />
            </div>
            <div className="mt-5 text-lg font-semibold tracking-tight text-slate-900">Nenhum imóvel encontrado</div>
            <div className="mt-2 text-sm text-slate-600">Ajuste a busca/filtros ou cadastre um novo imóvel.</div>
            <button
              type="button"
              onClick={() => openNew()}
              className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#2b6cff] px-6 text-sm font-semibold text-white shadow-[0_10px_26px_-18px_rgba(43,108,255,0.85)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#255fe6]"
            >
              <Plus className="h-4 w-4" />
              Cadastrar imóvel
            </button>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-3">
            {filteredRows.map((r) => {
              const photo = (r.photos_urls ?? [])[0] ?? null;
              const title = r.title ?? r.property_type ?? "Imóvel";
              const neighborhood = r.neighborhood ?? "-";
              const city = r.city ?? "";
              const local = city ? `${neighborhood} • ${city}` : neighborhood;
              const price = typeof r.price === "number" ? formatCurrencyBRL(r.price) : "-";
              const area = typeof r.area_m2 === "number" ? `${Math.round(r.area_m2)}m²` : "-";
              const bedrooms = typeof r.bedrooms === "number" ? r.bedrooms : null;
              const suites = typeof r.suites === "number" ? r.suites : null;
              const parking = typeof r.parking_spots === "number" ? r.parking_spots : null;
              const roomsLine =
                bedrooms != null || suites != null
                  ? `${bedrooms ?? 0} qtos | ${suites ?? 0} suíte${(suites ?? 0) === 1 ? "" : "s"}`
                  : "-";
              const parkingLine = parking != null ? `${parking} vaga${parking === 1 ? "" : "s"}` : "-";
              const ownerLast = (r as any)?.last_owner_contact_at ?? null;
              const ownerWhatsapp = String((r as any)?.owner_whatsapp ?? "").trim();
              const badgeStatus = (r.status ?? "disponivel") as PropertyStatus;
              const olx = getPortalValue(r as any, "olx");
              const zap = getPortalValue(r as any, "zap");
              const vivareal = getPortalValue(r as any, "vivareal");
              const syncOlx = Boolean(portalSyncByKey[`${r.id}:olx`]);
              const syncZap = Boolean(portalSyncByKey[`${r.id}:zap`]);
              const syncViva = Boolean(portalSyncByKey[`${r.id}:vivareal`]);

              return (
                <div
                  key={r.id}
                  className="group overflow-hidden rounded-2xl bg-white shadow-[0_10px_24px_-14px_rgba(15,23,42,0.55)] ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[2px]"
                >
                  <div className="relative h-44 w-full bg-slate-100">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-500">
                        <Camera className="h-8 w-8" />
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/55 via-slate-950/10 to-transparent" />

                    <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
                      <span
                        className={
                          "inline-flex items-center justify-center gap-1.5 rounded-full bg-white/55 px-3 py-1 text-xs font-semibold text-slate-900 ring-1 ring-white/70 backdrop-blur "
                        }
                      >
                        <Tag className="h-3.5 w-3.5" />
                        {purposeLabel((r.purpose ?? "venda") as PropertyPurpose)}
                      </span>
                      <span className="inline-flex items-center justify-center rounded-full bg-white/55 px-3 py-1 text-xs font-semibold text-slate-900 ring-1 ring-white/70 backdrop-blur">
                        {statusLabel[(r.status ?? "disponivel") as PropertyStatus]}
                      </span>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="text-base font-semibold tracking-tight text-slate-900 line-clamp-2">{title}</div>
                    <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-600">
                      <MapPin className="h-4 w-4 text-slate-500" />
                      <span className="truncate">
                        <span className="text-slate-700">{neighborhood}</span>
                        {city ? <span className="text-slate-500"> • {city}</span> : null}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50/80 p-3 ring-1 ring-slate-200/70">
                      <div className="flex items-center gap-2">
                        <Ruler className="h-4 w-4 text-slate-600" />
                        <div className="text-xs font-semibold text-slate-700">{area}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Cuboid className="h-4 w-4 text-slate-600" />
                        <div className="text-xs font-semibold text-slate-700">{roomsLine}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <CarFront className="h-4 w-4 text-slate-600" />
                        <div className="text-xs font-semibold text-slate-700">{parkingLine}</div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl bg-white p-3 ring-1 ring-slate-200/70">
                      <div className="text-[10px] font-semibold tracking-wide text-slate-500">Status nos Portais</div>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <PortalSwitch
                          label="OLX"
                          active={olx}
                          syncing={syncOlx}
                          onToggle={() => void togglePortal(r.id, "olx")}
                          brandOnCls="bg-gradient-to-r from-[#6E2594] to-[#8B2BD1] text-white"
                          brandRingOffCls="ring-[rgba(110,37,148,0.30)]"
                          brandTextOffCls="text-[#6E2594]"
                        />
                        <PortalSwitch
                          label="Zap Imóveis"
                          active={zap}
                          syncing={syncZap}
                          onToggle={() => void togglePortal(r.id, "zap")}
                          brandOnCls="bg-gradient-to-r from-[#0057FF] to-[#003CFF] text-white"
                          brandRingOffCls="ring-[rgba(0,87,255,0.30)]"
                          brandTextOffCls="text-[#004BFF]"
                        />
                        <PortalSwitch
                          label="Viva Real"
                          active={vivareal}
                          syncing={syncViva}
                          onToggle={() => void togglePortal(r.id, "vivareal")}
                          brandOnCls="bg-gradient-to-r from-[#00AEEF] to-[#0077C8] text-white"
                          brandRingOffCls="ring-[rgba(0,174,239,0.30)]"
                          brandTextOffCls="text-[#008ED6]"
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex items-end justify-between gap-4">
                      <div className="text-lg font-semibold tracking-tight text-emerald-600">{price}</div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (!ownerWhatsapp) return;
                            const url = `/admin/whatsapp?phone=${encodeURIComponent(ownerWhatsapp)}`;
                            window.location.href = url;
                          }}
                          disabled={!ownerWhatsapp}
                          className="inline-flex h-9 items-center justify-center rounded-xl bg-white px-2.5 text-xs font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Iniciar conversa com o proprietário"
                        >
                          WhatsApp
                        </button>
                        <button
                          type="button"
                          onClick={() => editRow(r)}
                          className="inline-flex h-9 items-center justify-center rounded-xl bg-white px-2.5 text-xs font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void openTransparencyReport({
                              propertyId: r.id,
                              propertyTitle: String(r.title ?? r.property_type ?? "Imóvel"),
                              propertyLocal:
                                [String(r.neighborhood ?? "").trim(), String(r.city ?? "").trim()].filter(Boolean).join(" • ") || "-",
                            }).catch((err) => {
                              setErrorMessage(String((err as any)?.message ?? "Não foi possível gerar o relatório."));
                            })
                          }
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50"
                          title="Gerar Relatório (PDF/Imagem)"
                          aria-label="Gerar Relatório"
                        >
                          <FileDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeRow(r.id)}
                          disabled={isDeletingId === r.id}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600 text-white shadow-sm transition-all duration-300 hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                          title={isDeletingId === r.id ? "Excluindo..." : "Excluir"}
                          aria-label={isDeletingId === r.id ? "Excluindo" : "Excluir"}
                        >
                          {isDeletingId === r.id ? (
                            <span className="text-[11px] font-extrabold">...</span>
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200/70">
                        <div className="text-[10px] font-semibold tracking-wide text-slate-500">Corretor</div>
                        <select
                          value={((r as any)?.[propertiesBrokerColumn] ?? r.broker_id ?? r.corretor_id ?? "") as any}
                          onChange={(e) => void updateCorretorInline(r.id, e.target.value)}
                          disabled={updatingFieldByRowId[r.id] === "corretor"}
                          className="mt-1 h-10 w-full rounded-xl bg-white px-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#2b6cff]/30 disabled:cursor-not-allowed disabled:bg-slate-50"
                        >
                          <option value="">Sem corretor</option>
                          {brokers.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.full_name ?? b.id}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200/70">
                        <div className="text-[10px] font-semibold tracking-wide text-slate-500">Premium</div>
                        <label className="mt-3 inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={Boolean(r.is_premium)}
                            onChange={(e) => void updatePremiumInline(r.id, e.target.checked)}
                            disabled={updatingFieldByRowId[r.id] === "premium"}
                            className="h-4 w-4"
                          />
                          <span className="text-xs font-semibold text-slate-600">
                            {updatingFieldByRowId[r.id] === "premium" ? "Salvando..." : r.is_premium ? "Ativo" : "Inativo"}
                          </span>
                        </label>
                      </div>

                      <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200/70">
                        <div className="text-[10px] font-semibold tracking-wide text-slate-500">
                          Último contato com proprietário
                        </div>
                        <div className="mt-1 text-xs font-semibold text-slate-700">{formatTimeBR(ownerLast)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {isFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center px-4 py-4 sm:items-center sm:py-8">
          <button
            type="button"
            onClick={() => {
              if (isSaving) return;
              setIsFormOpen(false);
              resetForm();
            }}
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Fechar"
          />

          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-[95vw] overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200/70 sm:max-w-5xl"
            style={{ maxHeight: "90vh" }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div>
                <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">NOVO IMÓVEL</div>
                <div className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                  {selectedId ? "Editar imóvel" : "Cadastro passo a passo"}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  1. Dados Básicos · 2. Características · 3. Mídia · 4. Status/Publicação
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (isSaving) return;
                    resetForm();
                  }}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSaving}
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isSaving) return;
                    setIsFormOpen(false);
                    resetForm();
                  }}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-700 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Fechar"
                  disabled={isSaving}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {errorMessage ? (
              <div className="px-6 pt-5">
                <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200/70">
                  {errorMessage}
                </div>
              </div>
            ) : null}

            <div
              className="grid grid-cols-1 gap-6 overflow-hidden px-6 py-6 md:grid-cols-12"
              style={{ maxHeight: "calc(90vh - 92px)" }}
            >
              <div className="md:col-span-3">
                <div className="flex flex-col gap-2 rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200/70">
                  {tabs.map((tab) => {
                    const isActive = tab.key === activeTab;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        className={
                          "flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left text-sm font-semibold transition-all duration-300 " +
                          (isActive
                            ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/70"
                            : "text-slate-600 hover:bg-white/70")
                        }
                      >
                        {tab.icon}
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="md:col-span-9 overflow-y-auto pr-1" style={{ maxHeight: "calc(90vh - 92px)" }}>
                <form onSubmit={save} className="flex flex-col gap-4">
                  {activeTab === "basicos" ? (
                    <>
                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold tracking-wide text-slate-600">Título</span>
                        <input
                          value={form.title}
                          onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                          className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                          placeholder="Ex: Apartamento alto padrão com vista"
                        />
                      </label>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <label className="flex flex-col gap-2">
                          <span className="text-xs font-semibold tracking-wide text-slate-600">Tipo</span>
                          <input
                            value={form.property_type}
                            onChange={(e) => setForm((s) => ({ ...s, property_type: e.target.value }))}
                            className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                            placeholder="Apartamento, Casa, Lote"
                            required
                          />
                        </label>

                        <label className="flex flex-col gap-2">
                          <span className="text-xs font-semibold tracking-wide text-slate-600">Finalidade</span>
                          <select
                            value={form.purpose}
                            onChange={(e) =>
                              setForm((s) => ({ ...s, purpose: e.target.value as PropertyPurpose }))
                            }
                            className="h-11 rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                          >
                            <option value="venda">Venda</option>
                            <option value="locacao">Locação</option>
                          </select>
                        </label>

                        <label className="flex flex-col gap-2">
                          <span className="text-xs font-semibold tracking-wide text-slate-600">Preço</span>
                          <input
                            value={form.price}
                            onChange={(e) => setForm((s) => ({ ...s, price: formatBRLInput(e.target.value) }))}
                            className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                            placeholder="R$ 0,00"
                            inputMode="decimal"
                          />
                        </label>

                        <label className="flex flex-col gap-2">
                          <span className="text-xs font-semibold tracking-wide text-slate-600">Porcentagem de Comissão</span>
                          <input
                            value={form.commission_percent}
                            onChange={(e) => setForm((s) => ({ ...s, commission_percent: e.target.value }))}
                            className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                            placeholder={commissionColumn ? "Ex: 5" : "Coluna não detectada"}
                            inputMode="decimal"
                            disabled={!commissionColumn}
                          />
                        </label>

                        <label className="flex flex-col gap-2">
                          <span className="text-xs font-semibold tracking-wide text-slate-600">Cidade</span>
                          <div className="relative">
                            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                              value={form.city}
                              onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
                              className="h-11 w-full rounded-xl bg-white pl-10 pr-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                              placeholder="Ex: Marabá"
                            />
                          </div>
                        </label>
                      </div>

                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold tracking-wide text-slate-600">Bairro</span>
                        <input
                          value={form.neighborhood}
                          onChange={(e) => setForm((s) => ({ ...s, neighborhood: e.target.value }))}
                          className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                          placeholder="Ex: Moinhos de Vento"
                        />
                      </label>

                      {selectedId ? (
                        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
                          <div className="text-[10px] font-semibold tracking-wide text-slate-500">FINANCEIRO</div>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                            <div className="text-xs font-semibold text-slate-700">Transparência</div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  void openTransparencyReport({
                                    propertyId: selectedId,
                                    propertyTitle: form.title.trim() || form.property_type || "Imóvel",
                                    propertyLocal: [form.neighborhood, form.city].filter(Boolean).join(" • ") || "-",
                                    lines: expenseLines,
                                  })
                                }
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50"
                                title="Gerar Relatório (PDF/Imagem)"
                              >
                                <FileDown className="h-4 w-4" />
                                Gerar Relatório
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!selectedId) return;
                                  openWhatsappWithTransparencyText(
                                    form.owner_whatsapp,
                                    form.title.trim() || form.property_type || "Imóvel",
                                  );
                                }}
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm transition-all duration-300 hover:bg-emerald-700"
                                title="Enviar mensagem por WhatsApp"
                              >
                                <Share2 className="h-4 w-4" />
                                Enviar WhatsApp
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!selectedId) return;
                                  void openTransparencyReport({
                                    propertyId: selectedId,
                                    propertyTitle: form.title.trim() || form.property_type || "Imóvel",
                                    propertyLocal: [form.neighborhood, form.city].filter(Boolean).join(" • ") || "-",
                                    lines: expenseLines,
                                  }).then(() => {
                                    setToastMessage("Relatório aberto. Use \"Imprimir/Salvar PDF\" na nova aba.");
                                    window.setTimeout(() => setToastMessage(null), 2600);
                                  });
                                }}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50"
                                aria-label="Abrir relatório para impressão"
                                title="Abrir para impressão"
                              >
                                <Printer className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                            {(() => {
                              const price = parseBRLInputToNumber(form.price) ?? 0;
                              const pctRaw = Number(String(form.commission_percent ?? "").replace(",", "."));
                              const pct = Number.isFinite(pctRaw) && pctRaw > 0 ? pctRaw : 5;
                              const commission = price > 0 ? (pct / 100) * price : 0;
                              const expensesTotal = expenseLines.reduce((acc, l) => acc + (Number(l.amount ?? 0) || 0), 0);
                              const net = Math.max(0, commission - expensesTotal);
                              return (
                                <>
                                  <div className="rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200/70">
                                    <div className="text-xs font-semibold text-slate-600">Comissão Prevista</div>
                                    <div className="mt-2 text-lg font-semibold text-slate-900">{formatCurrencyBRL(commission)}</div>
                                  </div>
                                  <div className="rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200/70">
                                    <div className="text-xs font-semibold text-slate-600">Gastos Vinculados</div>
                                    <div className="mt-2 text-lg font-semibold text-slate-900">
                                      {expensesLoading ? "Carregando..." : formatCurrencyBRL(expensesTotal)}
                                    </div>
                                  </div>
                                  <div className="rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-200/70">
                                    <div className="text-xs font-semibold text-emerald-800">Líquido</div>
                                    <div className="mt-2 text-lg font-semibold text-slate-900">{formatCurrencyBRL(net)}</div>
                                  </div>
                                </>
                              );
                            })()}
                          </div>

                          <div className="mt-4 overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200/70">
                            <div className="max-h-[320px] overflow-y-auto">
                              <table className="min-w-full border-separate border-spacing-0">
                                <thead>
                                  <tr className="bg-slate-50">
                                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">Data</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">Categoria</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">Descrição/Item</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-700">Valor (R$)</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-700">Ações</th>
                                  </tr>
                                </thead>
                                <tbody>
                                {expensesLoading ? (
                                  <tr>
                                    <td className="px-4 py-6 text-sm text-slate-600" colSpan={5}>
                                      Carregando gastos vinculados...
                                    </td>
                                  </tr>
                                ) : expenseLines.length > 0 ? (
                                  expenseLines.map((l, idx) => (
                                    <tr
                                      key={`${l.source}-${idx}`}
                                      className={
                                        "border-t border-slate-100 " +
                                        (l.done
                                          ? "bg-emerald-50/70"
                                          : idx % 2 === 1
                                            ? "bg-slate-50/50"
                                            : "bg-white")
                                      }
                                    >
                                      <td className="px-4 py-3 text-sm text-slate-700">
                                        {l.date ? new Date(l.date).toLocaleDateString("pt-BR") : "-"}
                                      </td>
                                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">{expenseSourceLabel(l.source)}</td>
                                      <td className={"px-4 py-3 text-sm " + (l.done ? "text-slate-500 line-through" : "text-slate-700")}>
                                        {(l.description ?? "").trim() || l.category || "-"}
                                      </td>
                                      <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                                        {formatCurrencyBRL(Number(l.amount ?? 0) || 0)}
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="flex justify-end gap-2">
                                          <button
                                            type="button"
                                            onClick={() => void concludeExpense(l)}
                                            className={
                                              "inline-flex h-9 items-center justify-center rounded-xl px-3 text-xs font-semibold ring-1 transition-all duration-300 " +
                                              (l.done
                                                ? "bg-emerald-100 text-emerald-900 ring-emerald-200/70"
                                                : "bg-white text-emerald-700 ring-emerald-200/70 hover:bg-emerald-50")
                                            }
                                            title="Concluir/Entregue"
                                            aria-label="Concluir/Entregue"
                                          >
                                            <BadgeCheck className="h-4 w-4" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => void deleteExpenseLine(l)}
                                            className="inline-flex h-9 items-center justify-center rounded-xl bg-red-50 px-3 text-xs font-semibold text-red-700 ring-1 ring-red-200/70 transition-all duration-300 hover:bg-red-100"
                                            title="Apagar"
                                            aria-label="Apagar"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td className="px-4 py-6 text-sm text-slate-600" colSpan={5}>
                                      Nenhum gasto vinculado a este imóvel.
                                    </td>
                                  </tr>
                                )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold tracking-wide text-slate-600">WhatsApp do Proprietário</span>
                        <input
                          value={form.owner_whatsapp}
                          onChange={(e) =>
                            setForm((s) => ({ ...s, owner_whatsapp: e.target.value.replace(/\D+/g, "") }))
                          }
                          className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                          placeholder="Ex: 5591999999999"
                          inputMode="numeric"
                          required
                        />
                        <div className="text-[11px] font-semibold text-slate-500">Use apenas números (DDD + número).</div>
                      </label>

                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold tracking-wide text-slate-600">Corretor</span>
                        <select
                          value={form.corretor_id}
                          onChange={(e) => setForm((s) => ({ ...s, corretor_id: e.target.value }))}
                          className="h-11 rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                        >
                          <option value="">Sem corretor</option>
                          {brokers.length === 0 ? (
                            <option value="" disabled>
                              Nenhum corretor ativo encontrado
                            </option>
                          ) : (
                            brokers.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.full_name ?? b.id}
                              </option>
                            ))
                          )}
                        </select>
                      </label>
                    </>
                  ) : null}

                  {activeTab === "caracteristicas" ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <label className="flex flex-col gap-2">
                          <span className="text-xs font-semibold tracking-wide text-slate-600">Quartos</span>
                          <input
                            value={form.bedrooms}
                            onChange={(e) => setForm((s) => ({ ...s, bedrooms: e.target.value }))}
                            className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                            inputMode="numeric"
                          />
                        </label>

                        <label className="flex flex-col gap-2">
                          <span className="text-xs font-semibold tracking-wide text-slate-600">Suítes</span>
                          <input
                            value={form.suites}
                            onChange={(e) => setForm((s) => ({ ...s, suites: e.target.value }))}
                            className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                            inputMode="numeric"
                          />
                        </label>

                        <label className="flex flex-col gap-2">
                          <span className="text-xs font-semibold tracking-wide text-slate-600">Banheiros</span>
                          <input
                            value={form.bathrooms}
                            onChange={(e) => setForm((s) => ({ ...s, bathrooms: e.target.value }))}
                            className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                            inputMode="numeric"
                          />
                        </label>

                        <label className="flex flex-col gap-2">
                          <span className="text-xs font-semibold tracking-wide text-slate-600">Vagas</span>
                          <input
                            value={form.parking_spots}
                            onChange={(e) => setForm((s) => ({ ...s, parking_spots: e.target.value }))}
                            className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                            inputMode="numeric"
                          />
                        </label>
                      </div>

                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold tracking-wide text-slate-600">Área (m²)</span>
                        <input
                          value={form.area_m2}
                          onChange={(e) => setForm((s) => ({ ...s, area_m2: e.target.value }))}
                          className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                          inputMode="decimal"
                        />
                      </label>
                    </>
                  ) : null}

                  {activeTab === "midia" ? (
                    <>
                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold tracking-wide text-slate-600">Fotos (1 URL por linha)</span>
                        <textarea
                          value={form.photos_urls}
                          onChange={(e) => setForm((s) => ({ ...s, photos_urls: e.target.value }))}
                          className="min-h-28 rounded-xl bg-white px-4 py-3 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                          placeholder="https://..."
                        />
                      </label>

                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold tracking-wide text-slate-600">Tour virtual / Vídeo (URL)</span>
                        <div className="relative">
                          <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            value={form.tour_url}
                            onChange={(e) => setForm((s) => ({ ...s, tour_url: e.target.value }))}
                            className="h-11 w-full rounded-xl bg-white pl-10 pr-4 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                            placeholder="https://youtube.com/..."
                          />
                        </div>
                      </label>
                    </>
                  ) : null}

                  {activeTab === "status" ? (
                    <>
                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold tracking-wide text-slate-600">Status</span>
                        <select
                          value={form.status}
                          onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as PropertyStatus }))}
                          className="h-11 rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                        >
                          <option value="disponivel">Disponível</option>
                          <option value="reservado">Reservado</option>
                          <option value="vendido">Vendido</option>
                          <option value="alugado">Alugado</option>
                          <option value="rascunho">Rascunho</option>
                          <option value="inativo">Inativo</option>
                        </select>
                      </label>

                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold tracking-wide text-slate-600">Descrição</span>
                        <div className="relative">
                          <FileText className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                          <textarea
                            value={form.description}
                            onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                            className="min-h-28 w-full rounded-xl bg-white pl-10 pr-4 pt-3 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#2b6cff]/30"
                          />
                        </div>
                      </label>
                    </>
                  ) : null}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Home className="h-4 w-4" />
                      {isSaving ? "Salvando..." : selectedId ? "Atualizar" : "Cadastrar"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}
