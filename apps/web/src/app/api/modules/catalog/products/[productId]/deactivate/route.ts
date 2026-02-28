import { NextResponse, type NextRequest } from "next/server";

import { getRequestActor } from "@/lib/auth/request-actor";
import { assertPermissionAndScope } from "@/lib/guards/permission-scope";
import { assertFeatureEnabled } from "@/lib/guards/subscription-feature";
import { ApiError, toErrorResponse } from "@/lib/http/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantFromRequest } from "@/lib/tenant/tenant-context";

export async function POST(request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  try {
    const tenant = await getTenantFromRequest(request);
    const actor = await getRequestActor(request, tenant.id);

    await assertFeatureEnabled(tenant, "inventory");
    await assertPermissionAndScope({
      tenantId: tenant.id,
      roleId: actor.roleId,
      permissionKey: "products.deactivate",
      actorPrimaryBranchId: actor.primaryBranchId,
      actorAssignedBranchIds: actor.assignedBranchIds,
    });

    const { productId } = await params;
    const supabase = createAdminClient();

    const { data: existing, error: readError } = await supabase
      .from("products")
      .select("id,tenant_id,is_active")
      .eq("id", productId)
      .single();

    if (readError || !existing?.id) throw new ApiError(404, "ALPI-PRD-NOTF-527", "Product not found.");
    if (existing.tenant_id !== tenant.id) throw new ApiError(403, "ALPI-PRD-PERM-528", "Cannot deactivate product from another tenant.");

    if (!existing.is_active) return NextResponse.json({ ok: true, item: { id: existing.id, is_active: false } });

    const { data, error } = await supabase
      .from("products")
      .update({ is_active: false })
      .eq("id", existing.id)
      .select("id,name,sku,is_active")
      .single();

    if (error || !data) throw new ApiError(500, "ALPI-PRD-INT-529", error?.message || "Failed to deactivate product.");

    return NextResponse.json({ ok: true, item: data });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
