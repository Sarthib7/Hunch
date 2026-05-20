import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

/**
 * Server-only Supabase client using the service-role key — bypasses RLS.
 * Use this for every backend write (round resolution, vote recording, payout).
 * Never import this into a client component.
 *
 * Lazily constructed so the app still builds when SUPABASE_SERVICE_ROLE_KEY
 * is unset; it only throws when a backend path actually needs it.
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — see .env.example",
    );
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
