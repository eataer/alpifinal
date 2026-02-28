import { NextResponse, type NextRequest } from "next/server";

import { getRequestActor } from "@/lib/auth/request-actor";
import { assertPermissionAndScope } from "@/lib/guards/permission-scope";
import { assertFeatureEnabled } from "@/lib/guards/subscription-feature";
import { ApiError, toErrorResponse } from "@/lib/http/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantFromRequest } from "@/lib/tenant/tenant-context";

export async function POST(request: NextRequest, { params }: { params: Promise<{ branchId: string }> }) {
  try {
    const tenant = await getTenantFromRequest(request);
    const actor = await getRequestActor(request, tenant.id);

    await assertFeatureEnabled(tenant, "organization");
    await assertPermissionAndScope({
      tenantId: tenant.id,
      roleId: actor.roleId,
      permissionKey: "branches.activate",
      actorPrimaryBranchId: actor.primaryBranchId,
      actorAssignedBranchIds: actor.assignedBranchIds,
    });

    const { branchId } = await params;
    const supabase = createAdminClient();

    const { data: branch, error: branchError } = await supabase
      .from("branches")
      .select("id,tenant_id,is_active")
      .eq("id", branchId)
      .single();

    if (branchError || !branch?.id) {
      throw new ApiError(404, "ALPI-BRCH-NOTF-138", "Branch not found.");
    }

    if (branch.tenant_id !== tenant.id) {
      throw new ApiError(403, "ALPI-BRCH-PERM-139", "Cannot activate branch from another tenant.");
    }

    if (branch.is_active) {
      return NextResponse.json({ ok: true, item: { id: branch.id, is_active: true } });
    }

    const { data, error } = await supabase
      .from("branches")
      .update({ is_active: true })
      .eq("id", branch.id)
      .select("id,name,code,address,phone,is_active,created_at")
      .single();

    if (error || !data) {
      throw new ApiError(500, "ALPI-BRCH-INT-140", error?.message || "Failed to activate branch.");
    }

    return NextResponse.json({ ok: true, item: data });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
