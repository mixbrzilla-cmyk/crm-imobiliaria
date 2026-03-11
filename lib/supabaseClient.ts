import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
      persistSession: typeof window !== "undefined",
      storage: typeof window === "undefined" ? undefined : undefined,
      autoRefreshToken: typeof window !== "undefined",
      detectSessionInUrl: typeof window !== "undefined",
    },
  });

  if (isBrowser) {
    cachedClient = client;
    cachedClientIsBrowser = true;
  }

  return client;
}
