import { NextResponse, type NextRequest } from "next/server";

import { getRequestActor } from "@/lib/auth/request-actor";
import { assertPermissionAndScope } from "@/lib/guards/permission-scope";
import { assertFeatureEnabled } from "@/lib/guards/subscription-feature";
import { ApiError, toErrorResponse } from "@/lib/http/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantFromRequest } from "@/lib/tenant/tenant-context";

type UpdateBranchPayload = {
  name?: string;
  address?: string | null;
  phone?: string | null;
};

function validatePayload(payload: Partial<UpdateBranchPayload>) {
  const name = payload.name?.trim();

  if (payload.name !== undefined && !name) {
    throw new ApiError(400, "ALPI-BRCH-VAL-116", "name cannot be empty.");
  }

  return {
    ...(name ? { name } : {}),
    ...(payload.address !== undefined ? { address: payload.address?.trim() || null } : {}),
    ...(payload.phone !== undefined ? { phone: payload.phone?.trim() || null } : {}),
  };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ branchId: string }> }) {
  try {
    const tenant = await getTenantFromRequest(request);
    const actor = await getRequestActor(request, tenant.id);

    await assertFeatureEnabled(tenant, "organization");
    await assertPermissionAndScope({
      tenantId: tenant.id,
      roleId: actor.roleId,
      permissionKey: "branches.update",
      actorPrimaryBranchId: actor.primaryBranchId,
      actorAssignedBranchIds: actor.assignedBranchIds,
    });

    const { branchId } = await params;
    const updatePayload = validatePayload((await request.json()) as Partial<UpdateBranchPayload>);

    if (Object.keys(updatePayload).length === 0) {
      throw new ApiError(400, "ALPI-BRCH-VAL-117", "At least one field is required for update.");
    }

    const supabase = createAdminClient();

    const { data: branch, error: readError } = await supabase
      .from("branches")
      .select("id,tenant_id")
      .eq("id", branchId)
      .single();

    if (readError || !branch?.id) {
      throw new ApiError(404, "ALPI-BRCH-NOTF-118", "Branch not found.");
    }

    if (branch.tenant_id !== tenant.id) {
      throw new ApiError(403, "ALPI-BRCH-PERM-119", "Cannot update branch from another tenant.");
    }

    const { data, error } = await supabase
      .from("branches")
      .update(updatePayload)
      .eq("id", branch.id)
      .select("id,name,code,address,phone,is_active,created_at")
      .single();

    if (error || !data) {
      throw new ApiError(500, "ALPI-BRCH-INT-120", error?.message || "Failed to update branch.");
    }

    return NextResponse.json({ ok: true, item: data });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
