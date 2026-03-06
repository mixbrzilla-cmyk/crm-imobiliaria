import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const noopStorage = {
  getItem: (_key: string) => null,
  setItem: (_key: string, _value: string) => {
    // no-op
  },
  removeItem: (_key: string) => {
    // no-op
  },
};

let cachedClient: SupabaseClient<any> | null = null;
let cachedClientIsBrowser = false;

export function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const isBrowser = typeof window !== "undefined";

  if (cachedClient && (!isBrowser || cachedClientIsBrowser)) return cachedClient;

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    db: {
      schema: "public",
    },
    auth: {
      persistSession: false,
      storage: typeof window === "undefined" ? undefined : (noopStorage as any),
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  if (isBrowser) {
    cachedClient = client;
    cachedClientIsBrowser = true;
  }

  return client;
}
