import type { NextRequest } from "next/server";

import { ApiError } from "@/lib/http/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";

export type TenantRecord = {
  id: string;
  name: string;
  subdomain: string;
  package_id: string | null;
  status: "active" | "suspended" | "trial" | "cancelled";
  subscription_status: "trial" | "active" | "suspended" | "expired" | "cancelled";
};

function getTenantSubdomainFromRequest(request: NextRequest): string | null {
  const headerSubdomain = request.headers.get("x-tenant-subdomain")?.trim();

  if (headerSubdomain) {
    return headerSubdomain;
  }

  const querySubdomain = request.nextUrl.searchParams.get("tenant_subdomain")?.trim();

  if (querySubdomain) {
    return querySubdomain;
  }

  return null;
}

export async function getTenantFromRequest(request: NextRequest): Promise<TenantRecord> {
  const tenantSubdomain = getTenantSubdomainFromRequest(request);

  if (!tenantSubdomain) {
    throw new ApiError(
      400,
      "ALPI-TEN-VAL-001",
      "Tenant subdomain is missing. Provide host-based subdomain or tenant_subdomain query param.",
    );
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("tenants")
    .select("id,name,subdomain,package_id,status,subscription_status")
    .eq("subdomain", tenantSubdomain)
    .single();

  if (error || !data) {
    throw new ApiError(404, "ALPI-TEN-NOTF-011", "Tenant not found for given subdomain.");
  }

  return data as TenantRecord;
}
