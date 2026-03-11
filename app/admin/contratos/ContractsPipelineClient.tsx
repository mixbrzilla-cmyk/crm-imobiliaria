"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { CheckCircle2, FileDown, FileText, Gavel, MessageCircle, PenLine, RefreshCw, Send, Signature, User, X } from "lucide-react";

import { getSupabaseClient } from "@/lib/supabaseClient";

type ContractStatus = "draft" | "juridico" | "assinatura" | "assinado";

type ContractRow = {
  id: string;
  title: string | null;
  status: ContractStatus | string | null;

  client_id: string | null;
  broker_id: string | null;
  property_id: string | null;
  development_id: string | null;

  template_body: string | null;
  rendered_body: string | null;

  document_url: string | null;

  signature_provider: string | null;
  signature_external_id: string | null;

  owner_name?: string | null;
  owner_whatsapp?: string | null;

  created_at?: string;
};

type ContractDocumentType = "rg" | "cpf" | "outro";

type ContractDocumentRow = {
  id: string;
  contract_id: string;
  doc_type: ContractDocumentType | string;
  url: string;
  created_at?: string;
};

type LeadRow = {
  id: string;
  full_name: string;
  phone: string;
  email?: string | null;
};

type BrokerProfile = {
  id: string;
  full_name: string | null;
};

type PropertyMini = {
  id: string;
  title: string | null;
  neighborhood: string | null;
  city: string | null;
  owner_name?: string | null;
  owner_whatsapp?: string | null;
};

type DevelopmentMini = {
  id: string;
  name: string;
  city: string | null;
  localidade: string | null;
  owner_name?: string | null;
  owner_whatsapp?: string | null;
};

type ContractModelKey = "compra_venda" | "locacao_residencial" | "locacao_comercial" | "exclusividade";

type NewContractForm = {
  model: ContractModelKey;
  client_id: string;
  broker_id: string;
  property_id: string;
  development_id: string;
  template_body: string;
  owner_name: string;
  owner_whatsapp: string;
};

const statusMeta: Array<{ key: ContractStatus; label: string; icon: React.ReactNode }> = [
  { key: "draft", label: "Draft", icon: <PenLine className="h-4 w-4" /> },
  { key: "juridico", label: "Jurídico", icon: <Gavel className="h-4 w-4" /> },
  { key: "assinatura", label: "Assinatura", icon: <Signature className="h-4 w-4" /> },
  { key: "assinado", label: "Assinado", icon: <CheckCircle2 className="h-4 w-4" /> },
];

function normalizeStatus(value: string | null | undefined): ContractStatus {
  const v = String(value ?? "draft").trim().toLowerCase();
  if (v === "juridico") return "juridico";
  if (v === "assinatura") return "assinatura";
  if (v === "assinado") return "assinado";
  return "draft";
}

function placeholderMap(args: {
  client: LeadRow | null;
  broker: BrokerProfile | null;
  property: PropertyMini | null;
  development: DevelopmentMini | null;
  owner_name: string | null;
  owner_whatsapp: string | null;
}) {
  const clientName = (args.client?.full_name ?? "").trim();
  const clientPhone = (args.client?.phone ?? "").trim();
  const brokerName = (args.broker?.full_name ?? "").trim();

  const propertyTitle = (args.property?.title ?? "").trim();
  const propertyLoc = [args.property?.neighborhood, args.property?.city].filter(Boolean).join(" • ");

  const developmentName = (args.development?.name ?? "").trim();
  const developmentLoc = [args.development?.localidade, args.development?.city].filter(Boolean).join(" • ");

  const ownerName =
    (args.owner_name ?? "").trim() ||
    (args.property?.owner_name ?? "").trim() ||
    (args.development?.owner_name ?? "").trim();
  const ownerWhats =
    (args.owner_whatsapp ?? "").trim() ||
    (args.property?.owner_whatsapp ?? "").trim() ||
    (args.development?.owner_whatsapp ?? "").trim();

  return {
    nome_cliente: clientName,
    whatsapp_cliente: clientPhone,
    nome_corretor: brokerName,
    titulo_imovel: propertyTitle,
    local_imovel: propertyLoc,
    nome_empreendimento: developmentName,
    local_empreendimento: developmentLoc,
    nome_proprietario: ownerName,
    whatsapp_proprietario: ownerWhats,
  } as Record<string, string>;
}

function renderTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    const k = String(key ?? "").trim();
    return vars[k] ?? "";
  });
}

function contractTitleFallback(c: ContractRow) {
  const base = (c.title ?? "").trim();
  if (base) return base;
  const link = c.property_id ? "Imóvel" : c.development_id ? "Empreendimento" : "Contrato";
  return `${link} • ${c.id.slice(0, 6)}`;
}

function escapeHtml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeWhatsapp(value: string) {
  return String(value ?? "")
    .replace(/\D+/g, "")
    .trim();
}

const contractModels: Array<{ key: ContractModelKey; label: string; template: string }> = [
  {
    key: "compra_venda",
    label: "Compra e Venda",
    template:
      "CONTRATO DE COMPRA E VENDA\n\nCliente: {{nome_cliente}}\nWhatsApp: {{whatsapp_cliente}}\nCorretor: {{nome_corretor}}\n\nImóvel: {{titulo_imovel}}\nLocal: {{local_imovel}}\n\nProprietário: {{nome_proprietario}}\nWhatsApp do Proprietário: {{whatsapp_proprietario}}\n\nCláusulas: (preencher...)\n",
  },
  {
    key: "locacao_residencial",
    label: "Locação Residencial",
    template:
      "CONTRATO DE LOCAÇÃO RESIDENCIAL\n\nLocatário: {{nome_cliente}}\nWhatsApp: {{whatsapp_cliente}}\nCorretor: {{nome_corretor}}\n\nImóvel: {{titulo_imovel}}\nLocal: {{local_imovel}}\n\nLocador/Proprietário: {{nome_proprietario}}\nWhatsApp do Proprietário: {{whatsapp_proprietario}}\n\nCondições: (preencher...)\n",
  },
  {
    key: "locacao_comercial",
    label: "Locação Comercial",
    template:
      "CONTRATO DE LOCAÇÃO COMERCIAL\n\nLocatário: {{nome_cliente}}\nWhatsApp: {{whatsapp_cliente}}\nCorretor: {{nome_corretor}}\n\nImóvel: {{titulo_imovel}}\nLocal: {{local_imovel}}\n\nLocador/Proprietário: {{nome_proprietario}}\nWhatsApp do Proprietário: {{whatsapp_proprietario}}\n\nCondições: (preencher...)\n",
  },
  {
    key: "exclusividade",
    label: "Exclusividade",
    template:
      "CONTRATO DE EXCLUSIVIDADE\n\nCliente: {{nome_cliente}}\nWhatsApp: {{whatsapp_cliente}}\nCorretor: {{nome_corretor}}\n\nObjeto (Imóvel/Empreendimento): {{titulo_imovel}}{{nome_empreendimento}}\nLocal: {{local_imovel}}{{local_empreendimento}}\n\nProprietário: {{nome_proprietario}}\nWhatsApp do Proprietário: {{whatsapp_proprietario}}\n\nCláusulas: (preencher...)\n",
  },
];

export default function ContractsPipelineClient() {
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [supportsContractsTable, setSupportsContractsTable] = useState(true);
  const [supportsDocsTable, setSupportsDocsTable] = useState(true);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [documents, setDocuments] = useState<ContractDocumentRow[]>([]);

  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [brokers, setBrokers] = useState<BrokerProfile[]>([]);
  const [properties, setProperties] = useState<PropertyMini[]>([]);
  const [developments, setDevelopments] = useState<DevelopmentMini[]>([]);

  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);

  const [isNewOpen, setIsNewOpen] = useState(false);
  const [newForm, setNewForm] = useState<NewContractForm>({
    model: "compra_venda",
    client_id: "",
    broker_id: "",
    property_id: "",
    development_id: "",
    template_body: contractModels[0].template,
    owner_name: "",
    owner_whatsapp: "",
  });

  const selectedContract = useMemo(
    () => contracts.find((c) => c.id === selectedContractId) ?? null,
    [contracts, selectedContractId],
  );

  const docsByContractId = useMemo(() => {
    const map = new Map<string, ContractDocumentRow[]>();
    for (const d of documents) {
      const list = map.get(d.contract_id) ?? [];
      list.push(d);
      map.set(d.contract_id, list);
    }
    return map;
  }, [documents]);

  const selectedDocs = useMemo(() => {
    if (!selectedContractId) return [];
    return docsByContractId.get(selectedContractId) ?? [];
  }, [docsByContractId, selectedContractId]);

  const selectedChecklist = useMemo(() => {
    const types = new Set(selectedDocs.map((d) => String(d.doc_type ?? "").toLowerCase().trim()));
    return {
      hasRG: types.has("rg"),
      hasCPF: types.has("cpf"),
    };
  }, [selectedDocs]);

  const leadById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const brokerById = useMemo(() => new Map(brokers.map((b) => [b.id, b])), [brokers]);
  const propertyById = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);
  const developmentById = useMemo(() => new Map(developments.map((d) => [d.id, d])), [developments]);

  const selectedPreview = useMemo(() => {
    if (!selectedContract) return "";
    const template = selectedContract.template_body ?? "";
    const vars = placeholderMap({
      client: selectedContract.client_id ? leadById.get(selectedContract.client_id) ?? null : null,
      broker: selectedContract.broker_id ? brokerById.get(selectedContract.broker_id) ?? null : null,
      property: selectedContract.property_id ? propertyById.get(selectedContract.property_id) ?? null : null,
      development: selectedContract.development_id ? developmentById.get(selectedContract.development_id) ?? null : null,
      owner_name: (selectedContract.owner_name ?? null) as string | null,
      owner_whatsapp: (selectedContract.owner_whatsapp ?? null) as string | null,
    });
    return renderTemplate(template, vars);
  }, [brokerById, developmentById, leadById, propertyById, selectedContract]);

  const selectedRenderedOrPreview = useMemo(() => {
    if (!selectedContract) return "";
    const rendered = (selectedContract.rendered_body ?? "").trim();
    if (rendered) return rendered;
    return selectedPreview;
  }, [selectedContract, selectedPreview]);

  const grouped = useMemo(() => {
    const base: Record<ContractStatus, ContractRow[]> = {
      draft: [],
      juridico: [],
      assinatura: [],
      assinado: [],
    };
    for (const c of contracts) {
      base[normalizeStatus(c.status)]?.push(c);
    }
    for (const k of Object.keys(base) as ContractStatus[]) {
      base[k].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    }
    return base;
  }, [contracts]);

  const loadAll = useCallback(async () => {
    setErrorMessage(null);
    setInfoMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      setSupportsContractsTable(false);
      setSupportsDocsTable(false);
      setContracts([]);
      setDocuments([]);
      setIsLoading(false);
      return;
    }

    try {
      const [contractsRes, docsRes, leadsRes, brokersRes, propsRes, devsRes] = await Promise.allSettled([
        (supabase as any)
          .from("contracts")
          .select(
            "id, title, status, client_id, broker_id, property_id, development_id, template_body, rendered_body, document_url, signature_provider, signature_external_id, owner_name, owner_whatsapp, created_at",
          )
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("contract_documents")
          .select("id, contract_id, doc_type, url, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("leads")
          .select("id, full_name, phone, email")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("profiles")
          .select("id, full_name")
          .eq("role", "broker")
          .order("full_name", { ascending: true }),
        (async () => {
          const attempts = [
            "id, title, neighborhood, city, owner_name, owner_whatsapp",
            "id, title, neighborhood, city",
            "id, title",
          ];
          const orderAttempts: Array<null | { column: string; ascending: boolean }> = [
            { column: "created_at", ascending: false },
            null,
          ];
          let last: any = null;
          for (const sel of attempts) {
            for (const ord of orderAttempts) {
              // eslint-disable-next-line no-await-in-loop
              const base = (supabase as any).from("properties").select(sel).limit(500);
              // eslint-disable-next-line no-await-in-loop
              const res = ord ? await base.order(ord.column, { ascending: ord.ascending }) : await base;
              if (!res?.error) return res;

              last = res;
              const msg = String(res?.error?.message ?? "");
              const isColumnError = /column .* does not exist|not found/i.test(msg);
              const code = (res?.error as any)?.code;
              const isSchemaMismatch = code === "PGRST204" || code === "PGRST301";

              console.error(
                "[Contracts] properties fetch attempt failed:",
                { select: sel, order: ord ? ord.column : null, code, msg },
                res?.error,
              );

              if (!isColumnError && !isSchemaMismatch) break;
            }
          }
          return last;
        })(),
        (async () => {
          const attempts = [
            "id, name, city, localidade, owner_name, owner_whatsapp",
            "id, title, city, localidade, owner_name, owner_whatsapp",
            "id, name, title, city, localidade",
            "id, title, city, localidade",
            "id, name, title",
          ];
          const orderAttempts: Array<null | { column: string; ascending: boolean }> = [
            { column: "created_at", ascending: false },
            null,
          ];
          let last: any = null;
          for (const sel of attempts) {
            for (const ord of orderAttempts) {
              // eslint-disable-next-line no-await-in-loop
              const base = (supabase as any).from("developments").select(sel).limit(500);
              // eslint-disable-next-line no-await-in-loop
              const res = ord ? await base.order(ord.column, { ascending: ord.ascending }) : await base;
              if (!res?.error) return res;

              last = res;
              const msg = String(res?.error?.message ?? "");
              const isColumnError = /column .* does not exist|not found/i.test(msg);
              const code = (res?.error as any)?.code;
              const isSchemaMismatch = code === "PGRST204" || code === "PGRST301";

              console.error(
                "[Contracts] developments fetch attempt failed:",
                { select: sel, order: ord ? ord.column : null, code, msg },
                res?.error,
              );

              if (!isColumnError && !isSchemaMismatch) break;
            }
          }
          return last;
        })(),
      ]);

      if (contractsRes.status === "fulfilled") {
        const r: any = contractsRes.value;
        if (r.error) {
          const code = (r.error as any)?.code;
          if (code === "42P01" || code === "PGRST204" || code === "PGRST301") {
            setSupportsContractsTable(false);
            setInfoMessage(
              "Infra pendente: crie as tabelas contracts/contract_documents no Supabase (SQL).",
            );
            setContracts([]);
          } else {
            setErrorMessage(r.error.message);
            setContracts([]);
          }
        } else {
          setSupportsContractsTable(true);
          setContracts((r.data ?? []) as ContractRow[]);
        }
      }

      if (docsRes.status === "fulfilled") {
        const r: any = docsRes.value;
        if (r.error) {
          const code = (r.error as any)?.code;
          if (code === "42P01" || code === "PGRST204" || code === "PGRST301") {
            setSupportsDocsTable(false);
            setDocuments([]);
          } else {
            setErrorMessage(r.error.message);
            setDocuments([]);
          }
        } else {
          setSupportsDocsTable(true);
          setDocuments((r.data ?? []) as ContractDocumentRow[]);
        }
      }

      if (leadsRes.status === "fulfilled" && !leadsRes.value.error) {
        setLeads((leadsRes.value.data ?? []) as LeadRow[]);
      }
      if (brokersRes.status === "fulfilled" && !brokersRes.value.error) {
        setBrokers((brokersRes.value.data ?? []) as BrokerProfile[]);
      }

      if (propsRes.status === "fulfilled") {
        const r: any = propsRes.value;
        if (r?.error) {
          console.error("[Contracts] Erro ao carregar properties:", r.error);
          setProperties([]);
        } else {
          const rows = (r.data ?? []) as PropertyMini[];
          setProperties(rows);
          if (rows.length === 0) {
            console.error("[Contracts] properties veio vazio. (sem erro)");
          }
        }
      }

      if (devsRes.status === "fulfilled") {
        const r: any = devsRes.value;
        if (r.error) {
          console.error("[Contracts] Erro ao carregar developments:", r.error);
          setDevelopments([]);
        } else {
          const raw = (r.data ?? []) as Array<any>;
          setDevelopments(
            raw.map((d) => ({
              id: String(d.id),
              name: String(d.name ?? d.title ?? "-").trim() || "-",
              city: (d.city ?? d.cidade ?? null) as string | null,
              localidade: (d.localidade ?? d.bairro ?? null) as string | null,
              owner_name: (d.owner_name ?? null) as string | null,
              owner_whatsapp: (d.owner_whatsapp ?? null) as string | null,
            })),
          );
          if (raw.length === 0) {
            console.error("[Contracts] developments veio vazio. (sem erro)");
          }
        }
      }

      if (!selectedContractId) {
        const first =
          (contractsRes.status === "fulfilled" && !(contractsRes.value as any)?.error
            ? ((contractsRes.value as any)?.data ?? [])[0]?.id
            : null) ?? null;
        if (first) setSelectedContractId(String(first));
      }
    } catch {
      setErrorMessage("Não foi possível carregar contratos agora.");
      setContracts([]);
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedContractId, supabase]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function createContract(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);
    if (!supabase) return;
    if (!supportsContractsTable) return;

    const model = contractModels.find((m) => m.key === newForm.model) ?? contractModels[0];
    const payloadBase: any = {
      id: crypto.randomUUID(),
      title: model.label,
      status: "draft",
      client_id: newForm.client_id.trim() || null,
      broker_id: newForm.broker_id.trim() || null,
      property_id: newForm.property_id.trim() || null,
      development_id: newForm.development_id.trim() || null,
      template_body: newForm.template_body,
      rendered_body: null,
      document_url: null,
      signature_provider: null,
      signature_external_id: null,
    };

    const payloadAttempts: Array<any> = [
      {
        ...payloadBase,
        owner_name: newForm.owner_name.trim() || null,
        owner_whatsapp: normalizeWhatsapp(newForm.owner_whatsapp),
      },
      payloadBase,
    ];

    try {
      let lastError: any = null;
      for (const payload of payloadAttempts) {
        // eslint-disable-next-line no-await-in-loop
        const res = await (supabase as any).from("contracts").insert(payload);
        if (!res.error) {
          lastError = null;
          break;
        }
        lastError = res.error;
        const msg = String((res.error as any)?.message ?? "");
        const isOwnerColumnError = /owner_name|owner_whatsapp/i.test(msg) && /does not exist|not found/i.test(msg);
        const code = (res.error as any)?.code;
        const isSchemaMismatch = code === "PGRST204" || code === "PGRST301";
        if (!isOwnerColumnError && !isSchemaMismatch) break;
      }

      if (lastError) {
        setErrorMessage(lastError.message);
        return;
      }
      setIsNewOpen(false);
      await loadAll();
    } catch {
      setErrorMessage("Não foi possível criar o contrato.");
    }
  }

  async function setStatus(contractId: string, next: ContractStatus) {
    setErrorMessage(null);
    if (!supabase) return;

    try {
      const res = await (supabase as any).from("contracts").update({ status: next }).eq("id", contractId);
      if (res.error) {
        setErrorMessage(res.error.message);
        return;
      }
      setContracts((current) => current.map((c) => (c.id === contractId ? { ...c, status: next } : c)));
    } catch {
      setErrorMessage("Não foi possível atualizar o status.");
    }
  }

  async function generateRendered(contractId: string) {
    setErrorMessage(null);
    if (!supabase) return;

    const c = contracts.find((x) => x.id === contractId) ?? null;
    if (!c) return;

    const vars = placeholderMap({
      client: c.client_id ? leadById.get(c.client_id) ?? null : null,
      broker: c.broker_id ? brokerById.get(c.broker_id) ?? null : null,
      property: c.property_id ? propertyById.get(c.property_id) ?? null : null,
      development: c.development_id ? developmentById.get(c.development_id) ?? null : null,
      owner_name: (c.owner_name ?? null) as string | null,
      owner_whatsapp: (c.owner_whatsapp ?? null) as string | null,
    });

    const rendered = renderTemplate(c.template_body ?? "", vars);

    try {
      const res = await (supabase as any)
        .from("contracts")
        .update({ rendered_body: rendered })
        .eq("id", contractId);
      if (res.error) {
        setErrorMessage(res.error.message);
        return;
      }
      setContracts((current) => current.map((x) => (x.id === contractId ? { ...x, rendered_body: rendered } : x)));
    } catch {
      setErrorMessage("Não foi possível gerar o preview.");
    }
  }

  async function addDocument(contractId: string, docType: ContractDocumentType, url: string) {
    setErrorMessage(null);
    if (!supabase) return;
    if (!supportsDocsTable) return;

    try {
      const payload = {
        id: crypto.randomUUID(),
        contract_id: contractId,
        doc_type: docType,
        url: url.trim(),
      };
      const res = await (supabase as any).from("contract_documents").insert(payload);
      if (res.error) {
        setErrorMessage(res.error.message);
        return;
      }
      await loadAll();
    } catch {
      setErrorMessage("Não foi possível anexar documento.");
    }
  }

  const canSendToSignature = Boolean(selectedContract && selectedChecklist.hasRG && selectedChecklist.hasCPF);

  const selectedOwnerName =
    (selectedContract?.owner_name ?? "").trim() ||
    (selectedContract?.property_id ? (propertyById.get(selectedContract.property_id)?.owner_name ?? "") : "").trim() ||
    (selectedContract?.development_id ? (developmentById.get(selectedContract.development_id)?.owner_name ?? "") : "").trim();
  const selectedOwnerWhats =
    (selectedContract?.owner_whatsapp ?? "").trim() ||
    (selectedContract?.property_id ? (propertyById.get(selectedContract.property_id)?.owner_whatsapp ?? "") : "").trim() ||
    (selectedContract?.development_id ? (developmentById.get(selectedContract.development_id)?.owner_whatsapp ?? "") : "").trim();

  async function exportPdf() {
    if (!selectedContract) return;
    const title = contractTitleFallback(selectedContract);
    const body = selectedRenderedOrPreview || "";
    const win = window.open("", "_blank");
    if (!win) {
      setErrorMessage("O navegador bloqueou a abertura da janela de exportação.");
      return;
    }
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; padding: 24px; }
      h1 { font-size: 18px; margin: 0 0 16px; }
      pre { white-space: pre-wrap; font-size: 12px; line-height: 1.45; }
    </style>
  </head>
  <body>
    <h1>${title}</h1>
    <pre>${escapeHtml(body)}</pre>
    <script>window.focus(); window.print();</script>
  </body>
</html>`;
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  async function sendWhatsApp() {
    if (!selectedContract) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    const lead = selectedContract.client_id ? leadById.get(selectedContract.client_id) ?? null : null;
    const clientPhone = normalizeWhatsapp(lead?.phone ?? "");
    const ownerPhone = normalizeWhatsapp(selectedOwnerWhats);

    const title = contractTitleFallback(selectedContract);
    const message = `*${title}*\n\n${selectedRenderedOrPreview || ""}`;

    if (!clientPhone && !ownerPhone) {
      setErrorMessage("Sem WhatsApp do cliente e sem WhatsApp do proprietário.");
      return;
    }

    try {
      const targets = [
        clientPhone ? { label: "cliente", phone: clientPhone } : null,
        ownerPhone ? { label: "proprietário", phone: ownerPhone } : null,
      ].filter(Boolean) as Array<{ label: string; phone: string }>;

      for (const t of targets) {
        // eslint-disable-next-line no-await-in-loop
        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: t.phone, message, as_boss: true }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? `Falha ao enviar WhatsApp para ${t.label}.`);
        }
      }

      setSuccessMessage("WhatsApp enviado.");
    } catch (e: any) {
      setErrorMessage(e?.message ?? "Não foi possível enviar WhatsApp.");
    }
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">CONTRATOS</div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Pipeline de Contratos</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadAll()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50"
            >
              <RefreshCw className={"h-4 w-4 " + (isLoading ? "animate-spin" : "")} />
              Recarregar
            </button>
            <button
              type="button"
              onClick={() => setIsNewOpen(true)}
              disabled={!supportsContractsTable}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#ff0000] px-5 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:bg-[#e60000] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FileText className="h-4 w-4" />
              Novo Contrato
            </button>
          </div>
        </div>
      </header>

      {errorMessage ? (
        <div className="rounded-2xl bg-rose-50 px-5 py-4 text-sm text-rose-800 ring-1 ring-rose-200/70">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-2xl bg-emerald-50 px-5 py-4 text-sm text-emerald-900 ring-1 ring-emerald-200/70">
          {successMessage}
        </div>
      ) : null}

      {infoMessage ? (
        <div className="rounded-2xl bg-amber-50 px-5 py-4 text-sm text-amber-900 ring-1 ring-amber-200/70">
          {infoMessage}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {statusMeta.map((col) => (
          <div key={col.key} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/70">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <span className="text-slate-600">{col.icon}</span>
                {col.label}
              </div>
              <div className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70">
                {grouped[col.key].length}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {grouped[col.key].length > 0 ? (
                grouped[col.key].map((c) => {
                  const title = contractTitleFallback(c);
                  const clientName = c.client_id ? (leadById.get(c.client_id)?.full_name ?? "") : "";
                  const brokerName = c.broker_id ? (brokerById.get(c.broker_id)?.full_name ?? "") : "";

                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedContractId(c.id)}
                      className={
                        "w-full rounded-2xl bg-slate-50 px-4 py-3 text-left ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-white " +
                        (selectedContractId === c.id ? "shadow-sm" : "")
                      }
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">{title}</div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                            <User className="h-3.5 w-3.5" />
                            <span className="truncate">{clientName || "Cliente"}</span>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">{brokerName ? `Corretor: ${brokerName}` : ""}</div>
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-xl bg-slate-50 px-4 py-4 text-sm text-slate-600 ring-1 ring-slate-200/70">
                  Sem contratos.
                </div>
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl bg-white p-6 ring-1 ring-slate-200/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Painel do Contrato</div>
            <div className="mt-1 text-xs text-slate-500">Template, checklist jurídico e ações de status.</div>
          </div>
          {selectedContract ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void exportPdf()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all hover:bg-slate-50"
              >
                <FileDown className="h-4 w-4" />
                Gerar PDF (Exportar)
              </button>

              <button
                type="button"
                onClick={() => void sendWhatsApp()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all hover:bg-slate-50"
              >
                <MessageCircle className="h-4 w-4" />
                Enviar WhatsApp
              </button>

              <button
                type="button"
                onClick={() => void generateRendered(selectedContract.id)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all hover:bg-slate-50"
              >
                <FileText className="h-4 w-4" />
                Gerar Preview
              </button>

              <button
                type="button"
                onClick={() => void setStatus(selectedContract.id, "juridico")}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all hover:bg-slate-50"
              >
                <Gavel className="h-4 w-4" />
                Enviar p/ Jurídico
              </button>

              <button
                type="button"
                disabled={!canSendToSignature}
                onClick={() => void setStatus(selectedContract.id, "assinatura")}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#001f3f] px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#001a33] disabled:cursor-not-allowed disabled:opacity-60"
                title={!canSendToSignature ? "Anexe RG e CPF antes de enviar para assinatura" : ""}
              >
                <Send className="h-4 w-4" />
                Enviar para Assinatura
              </button>

              <button
                type="button"
                onClick={() => void setStatus(selectedContract.id, "assinado")}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-700"
              >
                <CheckCircle2 className="h-4 w-4" />
                Marcar como Assinado
              </button>
            </div>
          ) : null}
        </div>

        {!selectedContract ? (
          <div className="mt-5 rounded-2xl bg-slate-50 px-5 py-6 text-sm text-slate-600 ring-1 ring-slate-200/70">
            Selecione um contrato no pipeline.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200/70">
              <div className="text-xs font-semibold tracking-wide text-slate-600">CHECKLIST JURÍDICO</div>
              <div className="mt-3 grid grid-cols-1 gap-3">
                <div className={"rounded-xl px-4 py-3 ring-1 " + (selectedChecklist.hasRG ? "bg-emerald-50 text-emerald-800 ring-emerald-200/70" : "bg-white text-slate-700 ring-slate-200/70")}
                >
                  RG {selectedChecklist.hasRG ? "(OK)" : "(pendente)"}
                </div>
                <div className={"rounded-xl px-4 py-3 ring-1 " + (selectedChecklist.hasCPF ? "bg-emerald-50 text-emerald-800 ring-emerald-200/70" : "bg-white text-slate-700 ring-slate-200/70")}
                >
                  CPF {selectedChecklist.hasCPF ? "(OK)" : "(pendente)"}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3">
                <QuickAttach
                  label="Anexar RG (URL)"
                  onAttach={(url) => void addDocument(selectedContract.id, "rg", url)}
                  disabled={!supportsDocsTable}
                />
                <QuickAttach
                  label="Anexar CPF (URL)"
                  onAttach={(url) => void addDocument(selectedContract.id, "cpf", url)}
                  disabled={!supportsDocsTable}
                />
              </div>

              {selectedDocs.length > 0 ? (
                <div className="mt-4 rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200/70">
                  <div className="text-xs font-semibold text-slate-700">Anexos</div>
                  <div className="mt-2 flex flex-col gap-2">
                    {selectedDocs.map((d) => (
                      <a
                        key={d.id}
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-[#001f3f] underline"
                      >
                        {String(d.doc_type ?? "documento").toUpperCase()} — {d.url}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200/70">
              <div className="text-xs font-semibold tracking-wide text-slate-600">TEMPLATE (PREVIEW)</div>
              <div className="mt-3 grid grid-cols-1 gap-3">
                <div className="rounded-xl bg-white p-4 text-xs text-slate-700 ring-1 ring-slate-200/70 whitespace-pre-wrap">
                  {selectedRenderedOrPreview || "(vazio)"}
                </div>
              </div>
              <div className="mt-3 text-[11px] font-semibold text-slate-500">
                Placeholders suportados: {"{{nome_cliente}}"}, {"{{whatsapp_cliente}}"}, {"{{nome_corretor}}"}, {"{{titulo_imovel}}"}, {"{{local_imovel}}"}, {"{{nome_empreendimento}}"}, {"{{local_empreendimento}}"}
              </div>
              <div className="mt-2 text-[11px] font-semibold text-slate-500">
                Proprietário: {"{{nome_proprietario}}"}, {"{{whatsapp_proprietario}}"}
              </div>
            </div>
          </div>
        )}
      </section>

      {isNewOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_-24px_rgba(15,23,42,0.65)] ring-1 ring-slate-200/70">
            <div className="flex items-start justify-between gap-6 border-b border-slate-100 px-6 py-5">
              <div>
                <div className="text-sm font-semibold text-slate-900">Novo Contrato</div>
                <div className="mt-1 text-xs text-slate-500">Vincule cliente/corretor e selecione imóvel ou empreendimento.</div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={createContract} className="px-6 py-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Modelo</span>
                  <select
                    value={newForm.model}
                    onChange={(e) => {
                      const model = e.target.value as ContractModelKey;
                      const meta = contractModels.find((m) => m.key === model) ?? contractModels[0];
                      setNewForm((s) => ({ ...s, model, template_body: meta.template }));
                    }}
                    className="h-11 rounded-xl bg-white px-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 outline-none"
                  >
                    {contractModels.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Cliente</span>
                  <select
                    value={newForm.client_id}
                    onChange={(e) => setNewForm((s) => ({ ...s, client_id: e.target.value }))}
                    className="h-11 rounded-xl bg-white px-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 outline-none"
                    required
                  >
                    <option value="" disabled>
                      Selecione...
                    </option>
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.full_name} • {l.phone}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Corretor</span>
                  <select
                    value={newForm.broker_id}
                    onChange={(e) => setNewForm((s) => ({ ...s, broker_id: e.target.value }))}
                    className="h-11 rounded-xl bg-white px-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 outline-none"
                    required
                  >
                    <option value="" disabled>
                      Selecione...
                    </option>
                    {brokers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.full_name ?? b.id}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Imóvel (opcional)</span>
                  <select
                    value={newForm.property_id}
                    onChange={(e) => {
                      const propertyId = e.target.value;
                      const p = propertyId ? propertyById.get(propertyId) ?? null : null;
                      setNewForm((s) => ({
                        ...s,
                        property_id: propertyId,
                        development_id: "",
                        owner_name: (p?.owner_name ?? "").toString(),
                        owner_whatsapp: (p?.owner_whatsapp ?? "").toString(),
                      }));
                    }}
                    className="h-11 rounded-xl bg-white px-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 outline-none"
                  >
                    <option value="">Nenhum</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {(p.title ?? "Imóvel").trim() || "Imóvel"} • {[p.neighborhood, p.city].filter(Boolean).join(" • ")}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Empreendimento (opcional)</span>
                  <select
                    value={newForm.development_id}
                    onChange={(e) => {
                      const developmentId = e.target.value;
                      const d = developmentId ? developmentById.get(developmentId) ?? null : null;
                      setNewForm((s) => ({
                        ...s,
                        development_id: developmentId,
                        property_id: "",
                        owner_name: (d?.owner_name ?? "").toString(),
                        owner_whatsapp: (d?.owner_whatsapp ?? "").toString(),
                      }));
                    }}
                    className="h-11 rounded-xl bg-white px-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 outline-none"
                  >
                    <option value="">Nenhum</option>
                    {developments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} • {[d.localidade, d.city].filter(Boolean).join(" • ")}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Owner name</span>
                  <input
                    value={newForm.owner_name}
                    onChange={(e) => setNewForm((s) => ({ ...s, owner_name: e.target.value }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none"
                    placeholder="Nome do proprietário"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Owner WhatsApp</span>
                  <input
                    value={newForm.owner_whatsapp}
                    onChange={(e) => setNewForm((s) => ({ ...s, owner_whatsapp: e.target.value }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none"
                    placeholder="Ex: 55DDDNUMERO"
                  />
                </label>

                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Template</span>
                  <textarea
                    value={newForm.template_body}
                    onChange={(e) => setNewForm((s) => ({ ...s, template_body: e.target.value }))}
                    className="min-h-48 rounded-xl bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none"
                  />
                </label>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewOpen(false)}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#001f3f] px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#001a33]"
                >
                  <Send className="h-4 w-4" />
                  Criar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function QuickAttach(args: { label: string; onAttach: (url: string) => void; disabled: boolean }) {
  const [url, setUrl] = useState("");
  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200/70">
      <div className="text-xs font-semibold text-slate-700">{args.label}</div>
      <div className="mt-2 flex items-center gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="h-10 flex-1 rounded-xl bg-white px-3 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none"
          placeholder="https://..."
          disabled={args.disabled}
        />
        <button
          type="button"
          onClick={() => {
            const trimmed = url.trim();
            if (!trimmed) return;
            args.onAttach(trimmed);
            setUrl("");
          }}
          disabled={args.disabled}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-[#ff0000] px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#e60000] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Anexar
        </button>
      </div>
    </div>
  );
}
