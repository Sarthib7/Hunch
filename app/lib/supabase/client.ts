import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY — see .env.example",
  );
}

/**
 * Browser Supabase client — public reads and Realtime subscriptions only.
 * RLS blocks every write; all writes go through the server client (server.ts).
 */
export const supabase = createClient<Database>(url, anonKey);
