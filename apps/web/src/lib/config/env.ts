type RequiredClientEnv = "NEXT_PUBLIC_SUPABASE_URL";

function readClientEnv(key: RequiredClientEnv): string {
  const value = process.env[key];

  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env var: ${key}`);
  }

  return value;
}

export const env = {
  supabaseUrl: readClientEnv("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    (() => {
      throw new Error(
        "Missing required env var: NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
      );
    })(),
  platformAdminDomain: process.env.PLATFORM_ADMIN_DOMAIN || "admin.alpi360.com",
  platformTenantRootDomain: process.env.PLATFORM_TENANT_ROOT_DOMAIN || "alpi360.com",
};
