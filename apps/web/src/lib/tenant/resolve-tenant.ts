import { env } from "@/lib/config/env";

export type TenantResolution = {
  isPlatformAdmin: boolean;
  tenantSubdomain: string | null;
  hostname: string;
};

function normalizeHost(hostHeader: string): string {
  return hostHeader.split(":")[0].toLowerCase();
}

export function resolveTenantFromHost(hostHeader: string | null): TenantResolution {
  const fallbackHost = env.platformAdminDomain;
  const hostname = normalizeHost(hostHeader || fallbackHost);

  if (hostname === env.platformAdminDomain) {
    return {
      isPlatformAdmin: true,
      tenantSubdomain: null,
      hostname,
    };
  }

  const root = env.platformTenantRootDomain;

  if (hostname === root || !hostname.endsWith(`.${root}`)) {
    return {
      isPlatformAdmin: false,
      tenantSubdomain: null,
      hostname,
    };
  }

  const subdomain = hostname.slice(0, -(root.length + 1));

  return {
    isPlatformAdmin: false,
    tenantSubdomain: subdomain || null,
    hostname,
  };
}
