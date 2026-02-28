import { NextResponse, type NextRequest } from "next/server";

import { getRequestActor } from "@/lib/auth/request-actor";
import { assertPermissionAndScope } from "@/lib/guards/permission-scope";
import { assertFeatureEnabled } from "@/lib/guards/subscription-feature";
import { ApiError, toErrorResponse } from "@/lib/http/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantFromRequest } from "@/lib/tenant/tenant-context";

export async function POST(request: NextRequest, { params }: { params: Promise<{ employeeId: string }> }) {
  try {
    const tenant = await getTenantFromRequest(request);
    const actor = await getRequestActor(request, tenant.id);

    await assertFeatureEnabled(tenant, "hr");
    await assertPermissionAndScope({
      tenantId: tenant.id,
      roleId: actor.roleId,
      permissionKey: "employees.terminate",
      actorPrimaryBranchId: actor.primaryBranchId,
      actorAssignedBranchIds: actor.assignedBranchIds,
    });

    const { employeeId } = await params;
    const supabase = createAdminClient();

    const { data: existing, error: readError } = await supabase
      .from("employees")
      .select("id,tenant_id,primary_branch_id,status")
      .eq("id", employeeId)
      .single();

    if (readError || !existing?.id) {
      throw new ApiError(404, "ALPI-EMP-NOTF-222", "Employee not found.");
    }
    if (existing.tenant_id !== tenant.id) {
      throw new ApiError(403, "ALPI-EMP-PERM-223", "Cannot terminate employee from another tenant.");
    }

    await assertPermissionAndScope({
      tenantId: tenant.id,
      roleId: actor.roleId,
      permissionKey: "employees.terminate",
      requestedBranchId: existing.primary_branch_id,
      actorPrimaryBranchId: actor.primaryBranchId,
      actorAssignedBranchIds: actor.assignedBranchIds,
    });

    if (existing.status === "terminated") {
      return NextResponse.json({
        ok: true,
        item: { id: existing.id, status: "terminated", primary_branch_id: existing.primary_branch_id },
      });
    }

    const { data, error } = await supabase
      .from("employees")
      .update({ status: "terminated", terminated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select("id,full_name,status,primary_branch_id,terminated_at")
      .single();

    if (error || !data) {
      throw new ApiError(500, "ALPI-EMP-INT-224", error?.message || "Failed to terminate employee.");
    }

    return NextResponse.json({ ok: true, item: data });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
