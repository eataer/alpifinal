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
      permissionKey: "categories.deactivate",
      actorPrimaryBranchId: actor.primaryBranchId,
      actorAssignedBranchIds: actor.assignedBranchIds,
    });

    const { categoryId } = await params;
    const supabase = createAdminClient();

    const { data: category, error: readError } = await supabase
      .from("categories")
      .select("id,tenant_id,is_active")
      .eq("id", categoryId)
      .single();

    if (readError || !category?.id) throw new ApiError(404, "ALPI-CAT-NOTF-324", "Category not found.");
    if (category.tenant_id !== tenant.id) throw new ApiError(403, "ALPI-CAT-PERM-325", "Cannot deactivate category from another tenant.");

    if (!category.is_active) return NextResponse.json({ ok: true, item: { id: category.id, is_active: false } });

    const { count: productCount, error: productCountError } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .eq("category_id", category.id)
      .eq("is_active", true);

    if (productCountError) {
      throw new ApiError(500, "ALPI-CAT-INT-326", productCountError.message || "Failed to check category usage.");
    }

    if ((productCount || 0) > 0) {
      throw new ApiError(400, "ALPI-CAT-STAT-327", "Category is used by active products. Update products first.");
    }

    await supabase.from("categories").update({ is_active: false }).eq("tenant_id", tenant.id).eq("parent_id", category.id);

    const { data, error } = await supabase
      .from("categories")
      .update({ is_active: false })
      .eq("id", category.id)
      .select("id,name,is_active")
      .single();

    if (error || !data) throw new ApiError(500, "ALPI-CAT-INT-328", error?.message || "Failed to deactivate category.");

    return NextResponse.json({ ok: true, item: data });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
