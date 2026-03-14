"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Search,
  Settings,
  User,
} from "lucide-react";

import { getSupabaseClient } from "@/lib/supabaseClient";

type ThreadRow = {
  id: string;
  external_id: string | null;
  contact_number: string | null;
  contact_name: string | null;
  assigned_broker_profile_id: string | null;
  status: string | null;
  last_message_at: string | null;
  created_at?: string;
};

type OwnerMatch = {
  source: "properties" | "developments";
  id: string;
  title: string;
};

type MessageRow = {
  id: string;
  thread_id: string;
  broker_id: string | null;
  direction: "in" | "out" | string;
  from_number: string | null;
  to_number: string | null;
  message: string;
  sent_at: string | null;
};

type WhatsappSettingsRow = {
  evolution_api_url?: string | null;
  evolution_global_api_key?: string | null;
  evolution_instance_is_open?: boolean | null;
  evolution_instance_state?: string | null;
  created_at?: string;
};

type SettingsFormState = {
  evolution_api_url: string;
  evolution_global_api_key: string;
};

type BrokerProfile = {
  id: string;
  full_name: string | null;
  status: string | null;
  role?: string | null;
};

function formatTime(value: string | null) {
  if (!value) return "-";
  try {
    const d = new Date(value);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function bubbleCls(direction: string) {
  if (direction === "out") {
    return "ml-auto bg-[#DCF8C6] text-slate-900";
  }
  return "mr-auto bg-white text-slate-900";
}

function initials(name: string | null) {
  const raw = (name ?? "").trim();
  if (!raw) return "?";
  const parts = raw.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase();
}

function avatarColorClass(seed: string) {
  const s = String(seed ?? "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const palette = [
    "bg-slate-900",
    "bg-emerald-600",
    "bg-indigo-600",
    "bg-rose-600",
    "bg-amber-600",
    "bg-sky-600",
  ];
  return palette[h % palette.length] ?? "bg-slate-900";
}

function fallbackAvatarText(name: string | null, number: string) {
  const n = String(name ?? "").trim();
  if (n) return initials(n);
  const digits = String(number ?? "").replace(/\D+/g, "");
  if (digits.length >= 2) return digits.slice(-2);
  return "?";
}

export default function WhatsAppPanelClient() {
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [settingsRowId, setSettingsRowId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [supportsTables, setSupportsTables] = useState(true);

  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const [ownerByWhatsapp, setOwnerByWhatsapp] = useState<Record<string, OwnerMatch>>({});

  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [isLoadingThreads, setIsLoadingThreads] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const [brokers, setBrokers] = useState<BrokerProfile[]>([]);
  const brokerById = useMemo(() => {
    const map = new Map<string, BrokerProfile>();
    for (const b of brokers) map.set(b.id, b);
    return map;
  }, [brokers]);

  const [draft, setDraft] = useState<string>("");
  const [isSending, setIsSending] = useState(false);

  const [bossMode, setBossMode] = useState(false);

  const [search, setSearch] = useState("");

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [supportsSettingsTable, setSupportsSettingsTable] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState<SettingsFormState>({
    evolution_api_url: "",
    evolution_global_api_key: "",
  });

  const [evolutionTestMessage, setEvolutionTestMessage] = useState<string | null>(null);

  const [isPairOpen, setIsPairOpen] = useState(false);
  const [isPairing, setIsPairing] = useState(false);
  const [pairQrDataUrl, setPairQrDataUrl] = useState<string | null>(null);
  const [pairInstanceName, setPairInstanceName] = useState<string | null>(null);

  const [pairConnectionState, setPairConnectionState] = useState<string | null>(null);
  const [isPollingPairStatus, setIsPollingPairStatus] = useState(false);

  const [evolutionIsOpen, setEvolutionIsOpen] = useState<boolean | null>(null);
  const [evolutionState, setEvolutionState] = useState<string | null>(null);

  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState("");
  const [newChatName, setNewChatName] = useState("");

  const [evolutionChats, setEvolutionChats] = useState<
    { number: string; name: string | null; lastMessage: string | null; avatarUrl: string | null }[]
  >([]);
  const [isSyncingChats, setIsSyncingChats] = useState(false);

  const [selectedEvolutionChat, setSelectedEvolutionChat] = useState<
    { number: string; name: string | null; lastMessage: string | null; avatarUrl: string | null } | null
  >(null);
  const [evolutionMessages, setEvolutionMessages] = useState<
    { id: string; direction: "in" | "out"; message: string; sent_at: string }[]
  >([]);
  const [isLoadingEvolutionMessages, setIsLoadingEvolutionMessages] = useState(false);

  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const [isCheckingWebhook, setIsCheckingWebhook] = useState(false);
  const [webhookMessage, setWebhookMessage] = useState<string | null>(null);

  const [isEnsuringWebhook, setIsEnsuringWebhook] = useState(false);

  const testProfilesConnection = useCallback(
    async (context: string, error: unknown) => {
      if (!supabase) return;
      try {
        const errAny = error as any;
        console.log("[Supabase Diagnostic]", {
          context,
          code: errAny?.code,
          message: errAny?.message,
          details: errAny?.details,
          hint: errAny?.hint,
        });
        const res = await supabase.from("profiles").select("id").limit(1);
        if (res.error) {
          console.log("DEBUG SUPABASE:", res.error);
          console.log("[Supabase Diagnostic] profiles query failed:", res.error);
        } else {
          console.log("[Supabase Diagnostic] profiles query OK:", {
            hasRow: (res.data ?? []).length > 0,
          });
        }
      } catch (e) {
        console.log("[Supabase Diagnostic] profiles query threw:", e);
      }
    },
    [supabase],
  );

  const selectedThread = useMemo(
    () => threads.find((t) => t.id === selectedThreadId) ?? null,
    [selectedThreadId, threads],
  );

  const selectedOwnerMatch = useMemo(() => {
    const num = String(selectedThread?.contact_number ?? "").replace(/\D+/g, "").trim();
    if (!num) return null;
    return ownerByWhatsapp[num] ?? null;
  }, [ownerByWhatsapp, selectedThread?.contact_number]);

  async function ensureThreadByPhone(phone: string) {
    const normalized = phone.replace(/\D+/g, "").trim();
    if (!normalized) return null;

    try {
      const res = await fetch("/api/whatsapp/thread/ensure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) return null;
      const id = json?.threadId ? String(json.threadId) : "";
      return id.trim() ? id : null;
    } catch {
      return null;
    }
  }

  const syncEvolutionChats = useCallback(async () => {
    if (isSyncingChats) return;
    setIsSyncingChats(true);
    try {
      const res = await fetch("/api/whatsapp/evolution/chats", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setEvolutionChats([]);
        return;
      }

      const rows = Array.isArray(json?.chats) ? json.chats : [];
      const normalized = rows
        .map((c: any) => ({
          number: String(c?.number ?? "").replace(/\D+/g, "").trim(),
          name: c?.name ? String(c.name) : null,
          lastMessage: c?.lastMessage ? String(c.lastMessage) : null,
          avatarUrl: c?.avatarUrl ? String(c.avatarUrl) : null,
        }))
        .filter((c: any) => Boolean(c.number));

      const needsName = normalized.filter((c: any) => !String(c?.name ?? "").trim()).map((c: any) => c.number);

      let namesByNumber: Record<string, string> = {};
      if (needsName.length > 0) {
        try {
          const r = await fetch("/api/whatsapp/leads/resolve-names", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ numbers: needsName.slice(0, 250) }),
          });
          const j = await r.json().catch(() => null);
          if (r.ok && j?.ok && j?.namesByNumber && typeof j.namesByNumber === "object") {
            namesByNumber = j.namesByNumber as Record<string, string>;
          }
        } catch {
          // silent
        }
      }

      setEvolutionChats(
        normalized.map((c: any) => {
          const leadName = namesByNumber[c.number];
          const name = String(c?.name ?? "").trim() ? c.name : leadName ? leadName : null;
          return { ...c, name };
        }),
      );
    } catch {
      setEvolutionChats([]);
    } finally {
      setIsSyncingChats(false);
    }
  }, [isSyncingChats]);

  const loadEvolutionMessages = useCallback(async (phone: string) => {
    const normalized = String(phone ?? "").replace(/\D+/g, "").trim();
    if (!normalized) return;
    if (isLoadingEvolutionMessages) return;
    setIsLoadingEvolutionMessages(true);
    try {
      const res = await fetch(`/api/whatsapp/evolution/messages?phone=${encodeURIComponent(normalized)}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setEvolutionMessages([]);
        return;
      }
      const rows = Array.isArray(json?.messages) ? json.messages : [];
      setEvolutionMessages(
        rows
          .map((m: any) => ({
            id: String(m?.id ?? crypto.randomUUID()),
            direction: m?.direction === "out" ? ("out" as const) : ("in" as const),
            message: String(m?.message ?? ""),
            sent_at: String(m?.sent_at ?? new Date().toISOString()),
          }))
          .filter((m: any) => Boolean(m.message)),
      );
    } catch {
      setEvolutionMessages([]);
    } finally {
      setIsLoadingEvolutionMessages(false);
    }
  }, [isLoadingEvolutionMessages]);

  const checkEvolutionWebhook = useCallback(async () => {
    setErrorMessage(null);
    setWebhookMessage(null);
    setIsCheckingWebhook(true);

    try {
      const res = await fetch("/api/whatsapp/evolution/webhook", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) {
        setErrorMessage(`Falha ao consultar webhook (HTTP ${res.status}).`);
        setIsCheckingWebhook(false);
        return;
      }

      if (!json.ok) {
        setErrorMessage(String(json?.text ?? json?.error ?? "Webhook não configurado/inalcançável."));
        setIsCheckingWebhook(false);
        return;
      }

      const url =
        json?.json?.webhook?.webhook?.url ??
        json?.json?.webhook?.url ??
        json?.json?.url ??
        null;

      const events =
        json?.json?.webhook?.webhook?.events ??
        json?.json?.webhook?.events ??
        null;

      setWebhookMessage(
        `Webhook OK. URL: ${String(url ?? "-")}. Events: ${Array.isArray(events) ? events.join(", ") : String(events ?? "-")}`,
      );
    } catch {
      setErrorMessage("Não foi possível consultar o webhook agora.");
    } finally {
      setIsCheckingWebhook(false);
    }
  }, []);

  const recreateEvolutionInstance = useCallback(async () => {
    setErrorMessage(null);
    setEvolutionTestMessage(null);
    setResetMessage(null);
    setPairQrDataUrl(null);
    setPairInstanceName(null);
    setPairConnectionState(null);
    setIsPairOpen(true);
    setIsPairing(true);

    try {
      const res = await fetch("/api/whatsapp/evolution/recreate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setErrorMessage(String(json?.error ?? `Falha ao recriar instância (HTTP ${res.status})`));
        setIsPairing(false);
        return;
      }

      const instanceName = json?.instanceName ? String(json.instanceName) : null;
      const qrDataUrl = json?.qr?.dataUrl ? String(json.qr.dataUrl) : null;

      setPairInstanceName(instanceName);
      setPairQrDataUrl(qrDataUrl);

      if (!qrDataUrl) {
        setErrorMessage(
          "Instância recriada, mas o QR Code não veio no connect. Verifique se a Evolution está liberando QR para a instância.",
        );
      }
    } catch {
      setErrorMessage("Não foi possível recriar a instância agora.");
    } finally {
      setIsPairing(false);
    }
  }, []);

  const ensureEvolutionWebhook = useCallback(async () => {
    setErrorMessage(null);
    setWebhookMessage(null);
    setIsEnsuringWebhook(true);

    try {
      const res = await fetch("/api/whatsapp/evolution/webhook/ensure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) {
        setErrorMessage(`Falha ao forçar webhook (HTTP ${res.status}).`);
        setIsEnsuringWebhook(false);
        return;
      }

      if (!json.ok) {
        setErrorMessage(String(json?.error ?? json?.set?.text ?? json?.find?.text ?? "Não foi possível forçar webhook."));
        setIsEnsuringWebhook(false);
        return;
      }

      const events =
        json?.find?.json?.webhook?.webhook?.events ??
        json?.find?.json?.webhook?.events ??
        json?.find?.json?.events ??
        null;

      setWebhookMessage(
        `Webhook atualizado. URL: ${String(json?.webhookUrl ?? "-")}. Events: ${Array.isArray(events) ? events.join(", ") : String(events ?? "-")}`,
      );
    } catch {
      setErrorMessage("Não foi possível forçar o webhook agora.");
    } finally {
      setIsEnsuringWebhook(false);
    }
  }, []);

  const filteredThreads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => {
      const hay = `${t.contact_name ?? ""} ${t.contact_number ?? ""} ${t.external_id ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [search, threads]);

  const loadBrokers = useCallback(async () => {
    if (!supabase) return;
    try {
      const res = await supabase
        .from("profiles")
        .select("id, full_name, status, role")
        .eq("role", "broker")
        .order("full_name", { ascending: true });
      if (!res.error) {
        const all = (res.data ?? []) as BrokerProfile[];
        const eligible = all.filter((b) => {
          const s = String(b.status ?? "").toLowerCase();
          return s === "ativo" || s === "aprovado";
        });
        setBrokers(eligible);
      }
    } catch {
      setBrokers([]);
    }
  }, [supabase]);

  const loadThreads = useCallback(async () => {
    setIsLoadingThreads(true);
    setErrorMessage(null);
    setInfoMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      setThreads([]);
      setIsLoadingThreads(false);
      return;
    }

    try {
      const res = await supabase
        .from("chat_threads")
        .select(
          "id, external_id, contact_number, contact_name, assigned_broker_profile_id, status, last_message_at, created_at",
        )
        .order("last_message_at", { ascending: false });

      if (res.error) {
        console.log("DEBUG SUPABASE:", res.error);
        console.log("[WhatsApp] Supabase error code:", (res.error as any)?.code);
        console.log("[WhatsApp] Erro ao carregar chat_threads:", res.error);
        const code = (res.error as any)?.code;
        if (code === "42P01" || code === "PGRST204" || code === "PGRST301") {
          await testProfilesConnection("loadThreads(chat_threads)", res.error);
        }
        throw res.error;
      }

      const rows = (res.data ?? []) as ThreadRow[];
      setThreads(rows);
      setSupportsTables(true);

      try {
        const numbers = Array.from(
          new Set(
            rows
              .map((r) => String(r.contact_number ?? "").replace(/\D+/g, "").trim())
              .filter(Boolean),
          ),
        );

        if (numbers.length === 0) {
          setOwnerByWhatsapp({});
        } else {
          const map: Record<string, OwnerMatch> = {};

          const [propsRes, devsRes] = await Promise.allSettled([
            supabase
              .from("properties")
              .select("id, title, owner_whatsapp")
              .in("owner_whatsapp", numbers)
              .limit(200),
            (supabase as any)
              .from("developments")
              .select("id, name, title, owner_whatsapp")
              .in("owner_whatsapp", numbers)
              .limit(200),
          ]);

          if (propsRes.status === "fulfilled" && !propsRes.value.error) {
            for (const r of (propsRes.value.data ?? []) as Array<any>) {
              const w = String(r?.owner_whatsapp ?? "").replace(/\D+/g, "").trim();
              if (!w) continue;
              map[w] = { source: "properties", id: String(r?.id ?? ""), title: String(r?.title ?? "Imóvel") };
            }
          }

          if (devsRes.status === "fulfilled") {
            const value: any = devsRes.value;
            if (!value?.error) {
              for (const r of (value?.data ?? []) as Array<any>) {
                const w = String(r?.owner_whatsapp ?? "").replace(/\D+/g, "").trim();
                if (!w) continue;
                map[w] = {
                  source: "developments",
                  id: String(r?.id ?? ""),
                  title: String(r?.name ?? r?.title ?? "Empreendimento"),
                };
              }
            }
          }

          setOwnerByWhatsapp(map);
        }
      } catch {
        setOwnerByWhatsapp({});
      }

      if (!selectedThreadId && rows.length > 0) {
        setSelectedThreadId(rows[0].id);
      }
    } catch {
      setSupportsTables(false);
      setThreads([]);
      setInfoMessage("Infra do WhatsApp pendente no Supabase (chat_threads/chat_messages). Execute o SQL para criar as tabelas.");
    } finally {
      setIsLoadingThreads(false);
    }
  }, [selectedThreadId, supabase]);

  useEffect(() => {
    if (!supabase) return;

    const channel = (supabase as any)
      .channel("admin-chat-threads-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_threads" },
        () => {
          void loadThreads();
        },
      )
      .subscribe();

    return () => {
      try {
        void (supabase as any).removeChannel(channel);
      } catch {
        // ignore
      }
    };
  }, [loadThreads, supabase]);

  const loadMessages = useCallback(
    async (threadId: string) => {
      setIsLoadingMessages(true);
      setErrorMessage(null);
      setInfoMessage(null);

      if (!supabase) {
        setMessages([]);
        setIsLoadingMessages(false);
        return;
      }

      try {
        const res = await supabase
          .from("chat_messages")
          .select(
            "id, thread_id, broker_id, direction, from_number, to_number, message, sent_at",
          )
          .eq("thread_id", threadId)
          .order("sent_at", { ascending: true });

        if (res.error) {
          console.log("DEBUG SUPABASE:", res.error);
          console.log("[WhatsApp] Supabase error code:", (res.error as any)?.code);
          console.log("[WhatsApp] Erro ao carregar chat_messages:", res.error);
          const code = (res.error as any)?.code;
          if (code === "42P01" || code === "PGRST204" || code === "PGRST301") {
            await testProfilesConnection("loadMessages(chat_messages)", res.error);
          }
          throw res.error;
        }

        setMessages((res.data ?? []) as MessageRow[]);
      } catch {
        setMessages([]);
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [supabase],
  );

  async function toggleBossMode() {
    setBossMode((v) => !v);
  }

  const loadSettings = useCallback(async () => {
    if (!supabase) return;
    try {
      let res: any = await supabase
        .from("whatsapp_settings")
        .select(
          "id, evolution_api_url, evolution_global_api_key, evolution_instance_is_open, evolution_instance_state, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (res.error) {
        res = await supabase
          .from("whatsapp_settings")
          .select("id, created_at")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
      }

      if (res.error) {
        console.log("DEBUG SUPABASE:", res.error);
        console.log("[WhatsApp] Supabase error code:", (res.error as any)?.code);
        console.log("[WhatsApp] Erro ao carregar whatsapp_settings:", res.error);
        const code = (res.error as any)?.code;
        if (code === "PGRST204" || code === "PGRST301") {
          await testProfilesConnection("loadSettings(whatsapp_settings)", res.error);
        }
        throw res.error;
      }

      const row = (res.data ?? null) as WhatsappSettingsRow | null;
      if (row) {
        const rawId = (res.data as any)?.id;
        const normalizedId = rawId ? String(rawId) : "";
        setSettingsRowId(normalizedId.trim() ? normalizedId : null);
        setSettingsForm({
          evolution_api_url: (row as any)?.evolution_api_url ?? "",
          evolution_global_api_key: (row as any)?.evolution_global_api_key ?? "",
        });

        if (typeof (row as any)?.evolution_instance_is_open === "boolean") {
          setEvolutionIsOpen(Boolean((row as any).evolution_instance_is_open));
        }
        setEvolutionState((row as any)?.evolution_instance_state ? String((row as any).evolution_instance_state) : null);
      } else {
        setSettingsRowId(null);
        setSettingsForm({ evolution_api_url: "", evolution_global_api_key: "" });
        setInfoMessage("Configure a Estação WhatsApp (Evolution API) para habilitar o gerenciador e testes de conexão.");
      }
      setSupportsSettingsTable(true);
    } catch {
      setSupportsSettingsTable(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;

    const channel = (supabase as any)
      .channel("admin-whatsapp-settings-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_settings" },
        (payload: any) => {
          const row = (payload?.new ?? payload?.record ?? null) as any;
          if (!row) return;
          if (typeof row?.evolution_instance_is_open === "boolean") setEvolutionIsOpen(Boolean(row.evolution_instance_is_open));
          setEvolutionState(row?.evolution_instance_state ? String(row.evolution_instance_state) : null);

          if (row?.evolution_instance_is_open === true) {
            void syncEvolutionChats();
          }
        },
      )
      .subscribe();

    return () => {
      try {
        void (supabase as any).removeChannel(channel);
      } catch {
        // ignore
      }
    };
  }, [supabase, syncEvolutionChats]);

  const saveSettings = useCallback(async () => {
    setErrorMessage(null);
    setEvolutionTestMessage(null);
    if (!supabase) return;
    if (!supportsSettingsTable) {
      setErrorMessage("Tabela whatsapp_settings não encontrada no Supabase.");
      return;
    }

    setIsSavingSettings(true);
    try {
      const payload = {
        evolution_api_url: settingsForm.evolution_api_url.trim() ? settingsForm.evolution_api_url.trim() : null,
        evolution_global_api_key: settingsForm.evolution_global_api_key.trim()
          ? settingsForm.evolution_global_api_key.trim()
          : null,
      };

      if (payload.evolution_api_url && !payload.evolution_global_api_key) {
        setErrorMessage("Preencha a Global API Key da Estação WhatsApp.");
        setIsSavingSettings(false);
        return;
      }

      let res: any;
      if (settingsRowId) {
        res = await (supabase as any).from("whatsapp_settings").update(payload).eq("id", settingsRowId);
      } else {
        const insertPayload = { id: crypto.randomUUID(), ...payload };
        res = await (supabase as any).from("whatsapp_settings").insert(insertPayload);
      }
      if (res.error) {
        console.log("DEBUG SUPABASE:", res.error);
        console.log("[WhatsApp] Erro ao salvar whatsapp_settings:", res.error);
        setErrorMessage(res.error.message);
        setIsSavingSettings(false);
        return;
      }

      setIsSavingSettings(false);
      setIsConfigOpen(false);
      await loadSettings();
      await loadThreads();
    } catch {
      setIsSavingSettings(false);
      setErrorMessage("Não foi possível salvar a configuração agora.");
    }
  }, [loadSettings, loadThreads, settingsForm, settingsRowId, supabase, supportsSettingsTable]);

  const testEvolution = useCallback(async () => {
    setErrorMessage(null);
    setEvolutionTestMessage(null);
    const url = settingsForm.evolution_api_url.trim();
    const key = settingsForm.evolution_global_api_key.trim();
    if (!url || !key) {
      setErrorMessage("Preencha URL da API e Global API Key.");
      return;
    }

    try {
      const res = await fetch("/api/whatsapp/evolution/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_url: url, global_api_key: key }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setErrorMessage(String(json?.error ?? `Falha ao testar conexão (HTTP ${res.status})`));
        return;
      }
      setEvolutionTestMessage(String(json?.message ?? "Conexão OK"));
    } catch {
      setErrorMessage("Não foi possível testar a conexão agora.");
    }
  }, [settingsForm.evolution_api_url, settingsForm.evolution_global_api_key]);

  const pairEvolution = useCallback(async () => {
    setErrorMessage(null);
    setEvolutionTestMessage(null);
    setResetMessage(null);
    setPairQrDataUrl(null);
    setPairInstanceName(null);
    setPairConnectionState(null);
    setIsPairOpen(true);
    setIsPairing(true);

    try {
      const res = await fetch("/api/whatsapp/evolution/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setErrorMessage(String(json?.error ?? `Falha ao parear (HTTP ${res.status})`));
        setIsPairing(false);
        return;
      }

      const instanceName = json?.instanceName ? String(json.instanceName) : null;
      const qrDataUrl = json?.qr?.dataUrl ? String(json.qr.dataUrl) : null;

      setPairInstanceName(instanceName);
      setPairQrDataUrl(qrDataUrl);

      if (!qrDataUrl) {
        setErrorMessage(
          "Instância criada/validada, mas o QR Code não veio no fetchInstances. Verifique se a Evolution está pronta para gerar o QR.",
        );
      }
    } catch {
      setErrorMessage("Não foi possível parear agora.");
    } finally {
      setIsPairing(false);
    }
  }, []);

  useEffect(() => {
    if (!isPairOpen) {
      setIsPollingPairStatus(false);
      return;
    }
    setIsPollingPairStatus(false);
  }, [isPairOpen]);

  const resetEvolutionInstance = useCallback(async () => {
    setErrorMessage(null);
    setEvolutionTestMessage(null);
    setResetMessage(null);
    setIsResetting(true);

    try {
      const res = await fetch("/api/whatsapp/evolution/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setErrorMessage(String(json?.error ?? `Falha ao resetar (HTTP ${res.status})`));
        setIsResetting(false);
        return;
      }

      setResetMessage("Instância limpa. Agora você pode clicar em 'Parear WhatsApp' para gerar um QR novo.");
    } catch {
      setErrorMessage("Não foi possível resetar agora.");
    } finally {
      setIsResetting(false);
    }
  }, []);

  async function assignThreadToBroker(threadId: string, brokerId: string) {
    if (!supabase) return;
    try {
      const res = await (supabase as any)
        .from("chat_threads")
        .update({ assigned_broker_profile_id: brokerId || null })
        .eq("id", threadId);
      if (!res.error) {
        setThreads((cur) =>
          cur.map((t) => (t.id === threadId ? { ...t, assigned_broker_profile_id: brokerId || null } : t)),
        );
      }
    } catch {
      // silent
    }
  }

  async function sendMessage() {
    setErrorMessage(null);

    if (evolutionIsOpen === false) {
      setErrorMessage("WhatsApp desconectado. Pareie a instância para liberar o envio.");
      return;
    }

    const phone = selectedThreadId
      ? String(selectedThread?.contact_number ?? "").trim()
      : String(selectedEvolutionChat?.number ?? "").replace(/\D+/g, "").trim();
    if (!phone) {
      setErrorMessage("Selecione uma conversa.");
      return;
    }

    const msg = draft.trim();
    if (!msg) return;

    setIsSending(true);

    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone,
          message: msg,
          thread_id: selectedThreadId || undefined,
          broker_id: selectedThread?.assigned_broker_profile_id ?? null,
          as_boss: selectedThread?.assigned_broker_profile_id ? false : true,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        setErrorMessage(json?.error ?? "Falha ao enviar mensagem.");
        setIsSending(false);
        return;
      }

      setDraft("");
      if (selectedThreadId) {
        await loadMessages(selectedThreadId);
        await loadThreads();
      } else {
        await loadEvolutionMessages(phone);
      }
    } catch {
      setErrorMessage("Não foi possível enviar a mensagem agora.");
    } finally {
      setIsSending(false);
    }
  }

  useEffect(() => {
    console.log("CONEXÃO TESTE:", {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });
    const t = setTimeout(() => {
      void loadBrokers();
      void loadThreads();
      void loadSettings();
    }, 0);
    return () => clearTimeout(t);
  }, [loadBrokers, loadSettings, loadThreads]);

  const activeChatKey = useMemo(() => {
    if (selectedThreadId) return `thread:${selectedThreadId}`;
    const num = String(selectedEvolutionChat?.number ?? "").replace(/\D+/g, "").trim();
    if (num) return `evo:${num}`;
    return "";
  }, [selectedEvolutionChat?.number, selectedThreadId]);

  useEffect(() => {
    if (!activeChatKey) return;
    setDraft("");
    setMessages([]);
    setEvolutionMessages([]);
  }, [activeChatKey]);

  useEffect(() => {
    if (evolutionIsOpen) {
      void syncEvolutionChats();
    }
  }, [evolutionIsOpen, syncEvolutionChats]);

  useEffect(() => {
    if (!selectedThreadId) return;
    void loadMessages(selectedThreadId);
  }, [loadMessages, selectedThreadId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const threadFromUrl = params.get("thread");
    if (!threadFromUrl) return;
    const exists = threads.some((t) => t.id === threadFromUrl);
    if (exists) setSelectedThreadId(threadFromUrl);
  }, [threads]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const phone = params.get("phone");
    if (!phone) return;
    void (async () => {
      const id = await ensureThreadByPhone(phone);
      if (id) {
        await loadThreads();
        setSelectedThreadId(id);
      }
    })();
  }, [loadThreads]);

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">WHATSAPP</div>
          <div className="text-2xl font-semibold tracking-tight text-slate-900">Painel WhatsApp</div>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200/70">
          {errorMessage}
        </div>
      ) : null}

      {infoMessage ? (
        <div className="rounded-2xl bg-amber-50 px-5 py-4 text-sm text-amber-900 ring-1 ring-amber-200/70">
          {infoMessage}
        </div>
      ) : null}

      <section className="h-[calc(100vh-100px)] overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
        <div className="flex h-full min-h-0 overflow-hidden">
          <aside className="flex h-full w-80 min-h-0 flex-col border-r border-slate-200/70 bg-slate-50">
            <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={
                      "h-2 w-2 rounded-full " +
                      (evolutionIsOpen ? "bg-emerald-500" : evolutionIsOpen === false ? "bg-amber-500" : "bg-slate-300")
                    }
                  />
                  <div className="truncate text-sm font-semibold text-slate-900">Boss Central</div>
                </div>
                <div className="truncate text-xs text-slate-500">
                  {evolutionState ? String(evolutionState) : "WhatsApp: -"}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsConfigOpen(true);
                  void loadSettings();
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-700 ring-1 ring-slate-200/70 transition-all hover:bg-slate-50"
                aria-label="Configurar WhatsApp"
                title="Configurar"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-slate-200/70 px-4 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar"
                  className="h-10 w-full rounded-xl bg-white pl-10 pr-3 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>

              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setIsNewChatOpen(true)}
                  className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-[#001f3f] px-4 text-sm font-semibold text-white transition-all hover:bg-[#001a33]"
                >
                  Nova conversa
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {evolutionIsOpen && evolutionChats.length > 0 ? (
                <div className="space-y-1">
                  {evolutionChats
                    .filter((c) => {
                      if (!search.trim()) return true;
                      const q = search.trim().toLowerCase();
                      return (
                        c.number.includes(q.replace(/\D+/g, "")) ||
                        (c.name ? c.name.toLowerCase().includes(q) : false) ||
                        (c.lastMessage ? c.lastMessage.toLowerCase().includes(q) : false)
                      );
                    })
                    .slice(0, 200)
                    .map((c) => {
                      const isActive = selectedEvolutionChat?.number === c.number;
                      const leadMatch = ownerByWhatsapp[c.number] ?? null;
                      const title =
                        c.name && c.name.trim()
                          ? c.name.trim()
                          : leadMatch?.title
                            ? leadMatch.title
                            : "Contato";
                      return (
                        <button
                          key={c.number}
                          type="button"
                          onClick={() => {
                            setSelectedThreadId(null);
                            setEvolutionMessages([]);
                            setDraft("");
                            setSelectedEvolutionChat(c);
                            void loadEvolutionMessages(c.number);
                          }}
                          className={
                            "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-all " +
                            (isActive
                              ? "bg-white shadow-sm ring-1 ring-slate-200/70"
                              : "bg-white/30 hover:bg-white hover:shadow-sm")
                          }
                        >
                          {c.avatarUrl ? (
                            <img
                              src={c.avatarUrl}
                              alt={c.name ? c.name : c.number}
                              className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-slate-200/70"
                            />
                          ) : (
                            <div
                              className={
                                "grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-semibold text-white " +
                                avatarColorClass(c.number)
                              }
                            >
                              {fallbackAvatarText(title, c.number)}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-slate-900">
                              {title}
                            </div>
                            <div className="truncate text-xs text-slate-500">{c.number}</div>
                            <div className="truncate text-xs text-slate-600">{c.lastMessage ? c.lastMessage : ""}</div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              ) : (
                <div className="px-3 py-6 text-sm text-slate-600">
                  {evolutionIsOpen ? "Nenhuma conversa." : "WhatsApp desconectado."}
                </div>
              )}
            </div>
          </aside>

          <main className="flex h-full min-h-0 flex-1 flex-col bg-white">
            <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">
                  {selectedEvolutionChat
                    ? selectedEvolutionChat.name ?? selectedEvolutionChat.number
                    : selectedThread
                      ? selectedThread.contact_name ?? selectedThread.contact_number ?? selectedThread.external_id ?? "-"
                      : "Selecione uma conversa"}
                </div>
                <div className="truncate text-xs text-slate-500">
                  {selectedEvolutionChat?.number ?? selectedThread?.contact_number ?? ""}
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-white px-4 py-4">
              {isLoadingEvolutionMessages || isLoadingMessages ? (
                <div className="text-sm text-slate-600">Carregando mensagens...</div>
              ) : (selectedEvolutionChat ? evolutionMessages : messages).length === 0 ? (
                <div className="mx-auto mt-10 w-full max-w-md rounded-2xl bg-slate-50 px-5 py-4 text-center text-sm text-slate-600 ring-1 ring-slate-200/70">
                  Selecione uma conversa para começar.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {(selectedEvolutionChat ? evolutionMessages : messages).map((m: any) => (
                    <div
                      key={m.id}
                      className={
                        "w-fit max-w-[82%] rounded-2xl px-4 py-2.5 text-sm " +
                        bubbleCls(m.direction)
                      }
                    >
                      <div className="whitespace-pre-wrap leading-relaxed">{m.message}</div>
                      <div className="mt-1 text-right text-[11px] font-medium text-slate-500">{formatTime(m.sent_at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200/70 bg-white p-3">
              <div className="flex items-end gap-2 rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200/70">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={selectedEvolutionChat || selectedThreadId ? "Mensagem" : "Selecione uma conversa"}
                  disabled={isSending}
                  className="min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-900 outline-none disabled:cursor-not-allowed"
                />

                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={
                    isSending ||
                    !draft.trim() ||
                    evolutionIsOpen === false ||
                    (!selectedThreadId && !selectedEvolutionChat)
                  }
                  title={
                    evolutionIsOpen === false
                      ? "WhatsApp desconectado. Pareie a instância."
                      : !selectedThreadId && !selectedEvolutionChat
                        ? "Selecione uma conversa"
                        : !draft.trim()
                          ? "Digite uma mensagem"
                          : ""
                  }
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-[#001f3f] px-4 text-sm font-semibold text-white transition-all hover:bg-[#001a33] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Enviar
                </button>
              </div>
            </div>
          </main>
        </div>
      </section>
      {isNewChatOpen ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 py-10">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-[0_25px_60px_-45px_rgba(0,0,0,0.55)] ring-1 ring-slate-200/70">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Nova conversa</div>
                  <div className="mt-1 text-xs text-slate-500">Informe o telefone com DDI + DDD (apenas números).</div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewChatOpen(false)}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50"
                >
                  Fechar
                </button>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Telefone</span>
                  <input
                    value={newChatPhone}
                    onChange={(e) => setNewChatPhone(e.target.value)}
                    placeholder="5531999999999"
                    className="h-11 rounded-2xl bg-slate-50 px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:bg-white focus:ring-2 focus:ring-[#001f3f]/10"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Nome (opcional)</span>
                  <input
                    value={newChatName}
                    onChange={(e) => setNewChatName(e.target.value)}
                    placeholder="Contato"
                    className="h-11 rounded-2xl bg-slate-50 px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:bg-white focus:ring-2 focus:ring-[#001f3f]/10"
                  />
                </label>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const digits = newChatPhone.replace(/\D+/g, "").trim();
                    if (digits.length < 8) {
                      setErrorMessage("Telefone inválido.");
                      return;
                    }

                    setSelectedThreadId(null);
                    setSelectedEvolutionChat({
                      number: digits,
                      name: newChatName.trim() ? newChatName.trim() : null,
                      lastMessage: null,
                      avatarUrl: null,
                    });
                    setIsNewChatOpen(false);
                    setNewChatPhone("");
                    setNewChatName("");
                    void loadEvolutionMessages(digits);
                  }}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#001f3f] px-6 text-sm font-semibold text-white shadow-[0_6px_14px_-10px_rgba(15,23,42,0.35)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#001a33]"
                >
                  Abrir conversa
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {isConfigOpen ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 py-10">
            <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-[0_25px_60px_-45px_rgba(0,0,0,0.55)] ring-1 ring-slate-200/70">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Configuração da Estação WhatsApp</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Defina a Evolution API (VPS) para QR Code e gerenciador de instâncias.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsConfigOpen(false)}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50"
                >
                  Fechar
                </button>
              </div>

              {!supportsSettingsTable ? (
                <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200/70">
                  Tabela <span className="font-semibold">whatsapp_settings</span> não encontrada no Supabase.
                </div>
              ) : null}

              {evolutionTestMessage ? (
                <div className="mt-4 rounded-3xl bg-emerald-50 px-5 py-4 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200/70">
                  {evolutionTestMessage}
                </div>
              ) : null}

              {resetMessage ? (
                <div className="mt-4 rounded-3xl bg-emerald-50 px-5 py-4 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200/70">
                  {resetMessage}
                </div>
              ) : null}

              {webhookMessage ? (
                <div className="mt-4 rounded-3xl bg-white px-5 py-4 text-xs font-semibold text-slate-900 ring-1 ring-slate-200/70">
                  {webhookMessage}
                </div>
              ) : null}

              <div className="mt-5 grid grid-cols-1 gap-4">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">URL da API</span>
                  <input
                    value={settingsForm.evolution_api_url}
                    onChange={(e) => setSettingsForm((s) => ({ ...s, evolution_api_url: e.target.value }))}
                    className="h-11 rounded-2xl bg-slate-50 px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
                    placeholder="http://187.77.240.10:8080"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Global API Key</span>
                  <input
                    value={settingsForm.evolution_global_api_key}
                    onChange={(e) => setSettingsForm((s) => ({ ...s, evolution_global_api_key: e.target.value }))}
                    className="h-11 rounded-2xl bg-slate-50 px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
                    placeholder="GLOBAL_API_KEY"
                  />
                </label>

                <div className="text-[11px] font-semibold text-slate-500">
                  Dica: use a URL base da VPS (com porta). Ex: http://187.77.240.10:8080
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => void ensureEvolutionWebhook()}
                  disabled={isEnsuringWebhook}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-white px-5 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isEnsuringWebhook ? "Forçando..." : "Forçar Webhook"}
                </button>
                <button
                  type="button"
                  onClick={() => void recreateEvolutionInstance()}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-white px-5 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50"
                >
                  Recriar Instância
                </button>
                <button
                  type="button"
                  onClick={() => void checkEvolutionWebhook()}
                  disabled={isCheckingWebhook}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-white px-5 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCheckingWebhook ? "Verificando..." : "Ver Webhook"}
                </button>
                <button
                  type="button"
                  onClick={() => void resetEvolutionInstance()}
                  disabled={isResetting}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-white px-5 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isResetting ? "Limpando..." : "Limpar Conexão"}
                </button>
                <button
                  type="button"
                  onClick={() => void pairEvolution()}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-white px-5 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50"
                >
                  Parear WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => void testEvolution()}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-white px-5 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50"
                >
                  Testar Conexão
                </button>
                <button
                  type="button"
                  onClick={() => void saveSettings()}
                  disabled={isSavingSettings || !supportsSettingsTable}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#ff0000] px-6 text-sm font-semibold text-white shadow-[0_6px_14px_-10px_rgba(15,23,42,0.35)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#e60000] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingSettings ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {isPairOpen ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 py-10">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-[0_25px_60px_-45px_rgba(0,0,0,0.55)] ring-1 ring-slate-200/70">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Parear WhatsApp</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Escaneie o QR Code no celular. Ao conectar, o painel fecha automaticamente.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPairOpen(false)}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50"
                >
                  Fechar
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70">
                <div>
                  Status: {pairConnectionState ? pairConnectionState : isPollingPairStatus ? "verificando..." : "-"}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPairConnectionState(null);
                    setIsPollingPairStatus(false);
                  }}
                  className="inline-flex h-9 items-center justify-center rounded-xl bg-white px-3 text-xs font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50"
                >
                  Atualizar
                </button>
              </div>

              <div className="mt-5 rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200/70">
                {isPairing ? (
                  <div className="text-sm font-semibold text-slate-700">Gerando QR Code...</div>
                ) : pairQrDataUrl ? (
                  <div className="flex flex-col items-center gap-4">
                    <img
                      src={pairQrDataUrl}
                      alt="QR Code WhatsApp"
                      className="h-72 w-72 rounded-2xl bg-white p-4 ring-1 ring-slate-200/70"
                    />
                    <div className="text-xs font-semibold text-slate-600">
                      Abra o WhatsApp no celular e escaneie o QR Code.
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-700">
                    QR Code não disponível no momento.
                  </div>
                )}
              </div>

              <div className="mt-5 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => void pairEvolution()}
                  disabled={isPairing}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-white px-5 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Atualizar QR
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
  );
}
