import { NextResponse, type NextRequest } from "next/server";

import { getRequestActor } from "@/lib/auth/request-actor";
import { assertPermissionAndScope } from "@/lib/guards/permission-scope";
import { assertFeatureEnabled } from "@/lib/guards/subscription-feature";
import { ApiError, toErrorResponse } from "@/lib/http/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantFromRequest } from "@/lib/tenant/tenant-context";

type UpdateDepartmentPayload = {
  name?: string;
  code?: string | null;
};

function validatePayload(payload: Partial<UpdateDepartmentPayload>) {
  const name = payload.name?.trim();

  if (payload.name !== undefined && !name) {
    throw new ApiError(400, "ALPI-DEPT-VAL-105", "name cannot be empty.");
  }

  return {
    ...(name ? { name } : {}),
    ...(payload.code !== undefined ? { code: payload.code?.trim() || null } : {}),
  };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ departmentId: string }> }) {
  try {
    const tenant = await getTenantFromRequest(request);
    const actor = await getRequestActor(request, tenant.id);

    await assertFeatureEnabled(tenant, "organization");
    await assertPermissionAndScope({
      tenantId: tenant.id,
      roleId: actor.roleId,
      permissionKey: "departments.update",
      actorPrimaryBranchId: actor.primaryBranchId,
      actorAssignedBranchIds: actor.assignedBranchIds,
    });

    const { departmentId } = await params;
    const updatePayload = validatePayload((await request.json()) as Partial<UpdateDepartmentPayload>);
    if (Object.keys(updatePayload).length === 0) {
      throw new ApiError(400, "ALPI-DEPT-VAL-106", "At least one field is required for update.");
    }

    const supabase = createAdminClient();
    const { data: existing, error: readError } = await supabase
      .from("departments")
      .select("id,tenant_id")
      .eq("id", departmentId)
      .single();

    if (readError || !existing?.id) {
      throw new ApiError(404, "ALPI-DEPT-NOTF-107", "Department not found.");
    }

    if (existing.tenant_id !== tenant.id) {
      throw new ApiError(403, "ALPI-DEPT-PERM-108", "Cannot update department from another tenant.");
    }

    const { data, error } = await supabase
      .from("departments")
      .update(updatePayload)
      .eq("id", existing.id)
      .select("id,name,code,is_active,created_at")
      .single();

    if (error || !data) {
      const code = error?.code === "23505" ? "ALPI-DEPT-VAL-109" : "ALPI-DEPT-INT-110";
      const message = error?.code === "23505" ? "Department already exists." : error?.message || "Failed to update department.";
      throw new ApiError(error?.code === "23505" ? 409 : 500, code, message);
    }

    return NextResponse.json({ ok: true, item: data });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
