import { NextResponse, type NextRequest } from "next/server";

import { getRequestActor } from "@/lib/auth/request-actor";
import { assertPermissionAndScope } from "@/lib/guards/permission-scope";
import { assertFeatureEnabled } from "@/lib/guards/subscription-feature";
import { ApiError, toErrorResponse } from "@/lib/http/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantFromRequest } from "@/lib/tenant/tenant-context";

export async function POST(request: NextRequest, { params }: { params: Promise<{ categoryId: string }> }) {
  try {
    const tenant = await getTenantFromRequest(request);
    const actor = await getRequestActor(request, tenant.id);

    await assertFeatureEnabled(tenant, "inventory");
    await assertPermissionAndScope({
      tenantId: tenant.id,
      roleId: actor.roleId,
      permissionKey: "categories.activate",
      actorPrimaryBranchId: actor.primaryBranchId,
      actorAssignedBranchIds: actor.assignedBranchIds,
    });

    const { categoryId } = await params;
    const supabase = createAdminClient();

    const { data: category, error: readError } = await supabase
      .from("categories")
      .select("id,tenant_id,is_active,parent_id")
      .eq("id", categoryId)
      .single();

    if (readError || !category?.id) throw new ApiError(404, "ALPI-CAT-NOTF-329", "Category not found.");
    if (category.tenant_id !== tenant.id) throw new ApiError(403, "ALPI-CAT-PERM-330", "Cannot activate category from another tenant.");

    if (category.parent_id) {
      const { data: parent, error: parentError } = await supabase
        .from("categories")
        .select("id,tenant_id,is_active")
        .eq("id", category.parent_id)
        .single();

      if (parentError || !parent?.id) throw new ApiError(400, "ALPI-CAT-STAT-331", "Parent category not found.");
      if (parent.tenant_id !== tenant.id || !parent.is_active) {
        throw new ApiError(400, "ALPI-CAT-STAT-332", "Parent category must be active before activating child.");
      }
    }

    if (category.is_active) return NextResponse.json({ ok: true, item: { id: category.id, is_active: true } });

    const { data, error } = await supabase
      .from("categories")
      .update({ is_active: true })
      .eq("id", category.id)
      .select("id,name,is_active")
      .single();

    if (error || !data) throw new ApiError(500, "ALPI-CAT-INT-333", error?.message || "Failed to activate category.");

    return NextResponse.json({ ok: true, item: data });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
