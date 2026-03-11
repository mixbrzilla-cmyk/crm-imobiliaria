"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { CheckCircle2, FileText, Gavel, PenLine, RefreshCw, Send, Signature, User, X } from "lucide-react";

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
};

type DevelopmentMini = {
  id: string;
  name: string;
  city: string | null;
  localidade: string | null;
};

type NewContractForm = {
  title: string;
  client_id: string;
  broker_id: string;
  property_id: string;
  development_id: string;
  template_body: string;
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
}) {
  const clientName = (args.client?.full_name ?? "").trim();
  const clientPhone = (args.client?.phone ?? "").trim();
  const brokerName = (args.broker?.full_name ?? "").trim();

  const propertyTitle = (args.property?.title ?? "").trim();
  const propertyLoc = [args.property?.neighborhood, args.property?.city].filter(Boolean).join(" • ");

  const developmentName = (args.development?.name ?? "").trim();
  const developmentLoc = [args.development?.localidade, args.development?.city].filter(Boolean).join(" • ");

  return {
    nome_cliente: clientName,
    whatsapp_cliente: clientPhone,
    nome_corretor: brokerName,
    titulo_imovel: propertyTitle,
    local_imovel: propertyLoc,
    nome_empreendimento: developmentName,
    local_empreendimento: developmentLoc,
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

export default function ContractsPipelineClient() {
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [supportsContractsTable, setSupportsContractsTable] = useState(true);
  const [supportsDocsTable, setSupportsDocsTable] = useState(true);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

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
    title: "",
    client_id: "",
    broker_id: "",
    property_id: "",
    development_id: "",
    template_body:
      "CONTRATO\n\nCliente: {{nome_cliente}}\nWhatsApp: {{whatsapp_cliente}}\nCorretor: {{nome_corretor}}\n\nImóvel: {{titulo_imovel}}\nLocal: {{local_imovel}}\n\nEmpreendimento: {{nome_empreendimento}}\nLocal: {{local_empreendimento}}\n",
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
    });
    return renderTemplate(template, vars);
  }, [brokerById, developmentById, leadById, propertyById, selectedContract]);

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
            "id, title, status, client_id, broker_id, property_id, development_id, template_body, rendered_body, document_url, signature_provider, signature_external_id, created_at",
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
        supabase
          .from("properties")
          .select("id, title, neighborhood, city")
          .order("created_at", { ascending: false })
          .limit(500),
        (supabase as any)
          .from("developments")
          .select("id, name, title, city, localidade")
          .order("created_at", { ascending: false })
          .limit(500),
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
      if (propsRes.status === "fulfilled" && !propsRes.value.error) {
        setProperties((propsRes.value.data ?? []) as PropertyMini[]);
      }
      if (devsRes.status === "fulfilled") {
        const r: any = devsRes.value;
        if (!r.error) {
          const raw = (r.data ?? []) as Array<any>;
          setDevelopments(
            raw.map((d) => ({
              id: String(d.id),
              name: String(d.name ?? d.title ?? "-").trim() || "-",
              city: (d.city ?? d.cidade ?? null) as string | null,
              localidade: (d.localidade ?? d.bairro ?? null) as string | null,
            })),
          );
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

    const payload: any = {
      id: crypto.randomUUID(),
      title: newForm.title.trim() || null,
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

    try {
      const res = await (supabase as any).from("contracts").insert(payload);
      if (res.error) {
        setErrorMessage(res.error.message);
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

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">CONTRATOS</div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Pipeline de Contratos</h1>
            <p className="text-sm leading-relaxed text-slate-600">
              Funil de status + geração de template com placeholders + trava jurídica (RG/CPF).
            </p>
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
                  {selectedPreview || "(vazio)"}
                </div>
              </div>
              <div className="mt-3 text-[11px] font-semibold text-slate-500">
                Placeholders suportados: {"{{nome_cliente}}"}, {"{{whatsapp_cliente}}"}, {"{{nome_corretor}}"}, {"{{titulo_imovel}}"}, {"{{local_imovel}}"}, {"{{nome_empreendimento}}"}, {"{{local_empreendimento}}"}
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
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Título</span>
                  <input
                    value={newForm.title}
                    onChange={(e) => setNewForm((s) => ({ ...s, title: e.target.value }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none"
                    placeholder="Ex: Contrato de Compra e Venda"
                  />
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
                    onChange={(e) => setNewForm((s) => ({ ...s, property_id: e.target.value, development_id: "" }))}
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
                    onChange={(e) => setNewForm((s) => ({ ...s, development_id: e.target.value, property_id: "" }))}
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
