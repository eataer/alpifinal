import { NextResponse, type NextRequest } from "next/server";

import { assertBootstrapAccess } from "@/lib/bootstrap/guard";
import { ApiError, toErrorResponse } from "@/lib/http/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";

type Payload = {
  tenantSubdomain: string;
  roleId?: string;
};

function validatePayload(raw: Partial<Payload>): Payload {
  const tenantSubdomain = raw.tenantSubdomain?.trim().toLowerCase();

  if (!tenantSubdomain) {
    throw new ApiError(400, "ALPI-TEN-VAL-100", "tenantSubdomain is required.");
  }

  return {
    tenantSubdomain,
    roleId: raw.roleId?.trim() || undefined,
  };
}

export async function POST(request: NextRequest) {
  try {
    assertBootstrapAccess(request);

    const payload = validatePayload((await request.json()) as Partial<Payload>);
    const supabase = createAdminClient();

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id,subdomain")
      .eq("subdomain", payload.tenantSubdomain)
      .single();

    if (tenantError || !tenant?.id) {
      throw new ApiError(404, "ALPI-TEN-NOTF-101", "Tenant not found.");
    }

    let roleId = payload.roleId;

    if (!roleId) {
      const { data: ownerRole, error: ownerRoleError } = await supabase
        .from("roles")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("name", "Firma Sahibi")
        .single();

      if (ownerRoleError || !ownerRole?.id) {
        throw new ApiError(404, "ALPI-PERM-NOTF-102", "Owner role not found for tenant.");
      }

      roleId = ownerRole.id;
    }

    const { data: targetRole, error: targetRoleError } = await supabase
      .from("roles")
      .select("id,tenant_id,is_active")
      .eq("id", roleId)
      .single();

    if (targetRoleError || !targetRole?.id) {
      throw new ApiError(404, "ALPI-PERM-NOTF-103", "Target role not found.");
    }

    if (targetRole.tenant_id !== tenant.id) {
      throw new ApiError(403, "ALPI-PERM-PERM-104", "Target role does not belong to tenant.");
    }

    if (!targetRole.is_active) {
      throw new ApiError(400, "ALPI-PERM-STAT-105", "Target role is inactive.");
    }

    const { data: permissions, error: permissionError } = await supabase.from("permissions").select("id");

    if (permissionError || !permissions) {
      throw new ApiError(500, "ALPI-PERM-INT-106", permissionError?.message || "Failed to read permissions.");
    }

    const { error: clearError } = await supabase.from("role_permissions").delete().eq("role_id", targetRole.id);

    if (clearError) {
      throw new ApiError(500, "ALPI-PERM-INT-107", clearError.message || "Failed to clear role permissions.");
    }

    if (permissions.length > 0) {
      const insertRows = permissions.map((permission) => ({
        role_id: targetRole.id,
        permission_id: permission.id,
        scope: "entire_company",
      }));

      const { error: insertError } = await supabase.from("role_permissions").insert(insertRows);

      if (insertError) {
        throw new ApiError(500, "ALPI-PERM-INT-108", insertError.message || "Failed to restore full permissions.");
      }
    }

    return NextResponse.json({
      ok: true,
      tenantSubdomain: tenant.subdomain,
      roleId: targetRole.id,
      restoredCount: permissions.length,
    });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
