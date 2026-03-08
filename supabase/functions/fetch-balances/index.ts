import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    const PLAID_CLIENT_ID = Deno.env.get("PLAID_CLIENT_ID");
    const PLAID_SECRET = Deno.env.get("PLAID_SECRET");
    const PLAID_ENV = Deno.env.get("PLAID_ENV") || "sandbox";

    if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
      return new Response(
        JSON.stringify({ error: "Plaid credentials not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const baseUrl = `https://${PLAID_ENV}.plaid.com`;

    // Get user's household bank connections
    const { data: profile } = await supabase
      .from("profiles")
      .select("household_id")
      .eq("user_id", userId)
      .single();

    if (!profile?.household_id) {
      return new Response(JSON.stringify({ error: "No household found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to read access tokens
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: connections } = await serviceSupabase
      .from("bank_connections")
      .select("*")
      .eq("household_id", profile.household_id)
      .eq("status", "active");

    if (!connections || connections.length === 0) {
      return new Response(
        JSON.stringify({ institutions: [] }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Pre-fetch existing is_hidden values for all connections
    const connectionIds = connections.map((c: any) => c.id);
    const { data: existingBalances } = await serviceSupabase
      .from("account_balances")
      .select("bank_connection_id, account_id, is_hidden")
      .in("bank_connection_id", connectionIds);

    const hiddenMap = new Map<string, boolean>();
    for (const row of existingBalances || []) {
      hiddenMap.set(`${row.bank_connection_id}:${row.account_id}`, row.is_hidden);
    }

    const institutions = [];

    for (const conn of connections) {
      const balanceRes = await fetch(`${baseUrl}/accounts/balance/get`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: PLAID_CLIENT_ID,
          secret: PLAID_SECRET,
          access_token: conn.access_token,
        }),
      });

      const balanceData = await balanceRes.json();

      if (!balanceData.error_code) {
        const accounts = (balanceData.accounts || []).map((a: any) => ({
          account_id: a.account_id,
          name: a.name,
          type: a.type,
          subtype: a.subtype,
          current_balance: a.balances.current || 0,
          available_balance: a.balances.available,
        }));

        institutions.push({
          institution: conn.institution_name,
          connection_id: conn.id,
          accounts,
        });

        // Update cached balances, preserving is_hidden
        for (const acct of accounts) {
          const hiddenKey = `${conn.id}:${acct.account_id}`;
          await serviceSupabase.from("account_balances").upsert(
            {
              bank_connection_id: conn.id,
              account_id: acct.account_id,
              name: acct.name,
              type: acct.type,
              subtype: acct.subtype,
              current_balance: acct.current_balance,
              available_balance: acct.available_balance,
              is_hidden: hiddenMap.get(hiddenKey) ?? false,
              last_synced_at: new Date().toISOString(),
            },
            { onConflict: "bank_connection_id,account_id" }
          );
        }
      }
    }

    return new Response(
      JSON.stringify({ institutions }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
