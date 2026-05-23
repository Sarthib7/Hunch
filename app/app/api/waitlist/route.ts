import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

interface WaitlistBody {
  address: string;
}

/**
 * Capture a visitor's address for the trust-grant waitlist. Called from the
 * `verified === false` UI branch when someone wants to play but isn't yet
 * trust-verified on the Circles graph. The operator (Hunch pool owner)
 * later runs scripts/trust-voters.mjs against `select address from waitlist
 * where not trusted` to grant on-chain trust.
 *
 * No auth — the worst a malicious caller can do is fill the table with
 * random addresses, which the operator filters by hand anyway. RLS keeps
 * writes exclusive to the service role.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as WaitlistBody | null;
  if (
    !body ||
    typeof body.address !== "string" ||
    !ADDRESS_RE.test(body.address)
  ) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }

  const address = body.address.toLowerCase();
  const db = supabaseAdmin();

  // Idempotent: surface "already on list" so the client doesn't blink "added!"
  // a second time and we don't bump created_at on repeat clicks.
  const { data: existing } = await db
    .from("waitlist")
    .select("address")
    .eq("address", address)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, alreadyOnList: true });
  }

  const { error } = await db.from("waitlist").insert({ address });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, alreadyOnList: false });
}
