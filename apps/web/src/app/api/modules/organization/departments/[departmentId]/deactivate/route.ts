import { NextResponse, type NextRequest } from "next/server";

import { getRequestActor } from "@/lib/auth/request-actor";
import { assertPermissionAndScope } from "@/lib/guards/permission-scope";
import { assertFeatureEnabled } from "@/lib/guards/subscription-feature";
import { ApiError, toErrorResponse } from "@/lib/http/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantFromRequest } from "@/lib/tenant/tenant-context";

export async function POST(request: NextRequest, { params }: { params: Promise<{ departmentId: string }> }) {
  try {
    const tenant = await getTenantFromRequest(request);
    const actor = await getRequestActor(request, tenant.id);

    await assertFeatureEnabled(tenant, "organization");
    await assertPermissionAndScope({
      tenantId: tenant.id,
      roleId: actor.roleId,
      permissionKey: "departments.deactivate",
      actorPrimaryBranchId: actor.primaryBranchId,
      actorAssignedBranchIds: actor.assignedBranchIds,
    });

    const { departmentId } = await params;
    const supabase = createAdminClient();

    const { data: department, error: readError } = await supabase
      .from("departments")
      .select("id,tenant_id,is_active")
      .eq("id", departmentId)
      .single();

    if (readError || !department?.id) {
      throw new ApiError(404, "ALPI-DEPT-NOTF-111", "Department not found.");
    }

    if (department.tenant_id !== tenant.id) {
      throw new ApiError(403, "ALPI-DEPT-PERM-112", "Cannot deactivate department from another tenant.");
    }

    if (!department.is_active) {
      return NextResponse.json({ ok: true, item: { id: department.id, is_active: false } });
    }

    const { data, error } = await supabase
      .from("departments")
      .update({ is_active: false })
      .eq("id", department.id)
      .select("id,name,code,is_active,created_at")
      .single();

    if (error || !data) {
      throw new ApiError(500, "ALPI-DEPT-INT-113", error?.message || "Failed to deactivate department.");
    }

    return NextResponse.json({ ok: true, item: data });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
