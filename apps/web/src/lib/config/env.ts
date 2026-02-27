type RequiredClientEnv = "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY";

function readClientEnv(key: RequiredClientEnv): string {
  const value = process.env[key];

  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env var: ${key}`);
  }

  return value;
}

export const env = {
  supabaseUrl: readClientEnv("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: readClientEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  platformAdminDomain: process.env.PLATFORM_ADMIN_DOMAIN || "admin.alpi360.com",
  platformTenantRootDomain: process.env.PLATFORM_TENANT_ROOT_DOMAIN || "alpi360.com",
};
