import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/config/env";

export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey || serviceRoleKey.trim().length === 0) {
    throw new Error("Missing required env var: SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(env.supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
