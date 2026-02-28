import { NextResponse, type NextRequest } from "next/server";

import { getRequestActor } from "@/lib/auth/request-actor";
import { assertPermissionAndScope } from "@/lib/guards/permission-scope";
import { assertFeatureEnabled } from "@/lib/guards/subscription-feature";
import { ApiError, toErrorResponse } from "@/lib/http/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantFromRequest } from "@/lib/tenant/tenant-context";

type UpdateCategoryPayload = {
  name?: string;
  parentId?: string | null;
  categoryClass?: "product" | "service" | "transaction";
  stockBehavior?: "decrease" | "increase" | "none";
  defaultTrackingType?: "none" | "serial" | "imei" | "iccid";
  productRequired?: boolean;
  requiresSim?: boolean;
  affectsKpi?: boolean;
  affectsRevenue?: boolean;
  vatRate?: number | null;
  sortOrder?: number;
};

const categoryClassSet = new Set(["product", "service", "transaction"]);
const stockBehaviorSet = new Set(["decrease", "increase", "none"]);
const trackingSet = new Set(["none", "serial", "imei", "iccid"]);

function normalizeUpdate(payload: Partial<UpdateCategoryPayload>) {
  const out: Record<string, string | number | boolean | null> = {};

  if (payload.name !== undefined) {
    const name = payload.name.trim();
    if (!name) throw new ApiError(400, "ALPI-CAT-VAL-311", "name cannot be empty.");
    out.name = name;
  }

  if (payload.parentId !== undefined) out.parent_id = payload.parentId?.trim() || null;

  if (payload.categoryClass !== undefined) {
    if (!categoryClassSet.has(payload.categoryClass)) throw new ApiError(400, "ALPI-CAT-VAL-312", "categoryClass is invalid.");
    out.category_class = payload.categoryClass;
  }

  if (payload.stockBehavior !== undefined) {
    if (!stockBehaviorSet.has(payload.stockBehavior)) throw new ApiError(400, "ALPI-CAT-VAL-313", "stockBehavior is invalid.");
    out.stock_behavior = payload.stockBehavior;
  }

  if (payload.defaultTrackingType !== undefined) {
    if (!trackingSet.has(payload.defaultTrackingType)) throw new ApiError(400, "ALPI-CAT-VAL-314", "defaultTrackingType is invalid.");
    out.default_tracking_type = payload.defaultTrackingType;
  }

  if (payload.productRequired !== undefined) out.product_required = payload.productRequired;
  if (payload.requiresSim !== undefined) out.requires_sim = payload.requiresSim;
  if (payload.affectsKpi !== undefined) out.affects_kpi = payload.affectsKpi;
  if (payload.affectsRevenue !== undefined) out.affects_revenue = payload.affectsRevenue;
  if (payload.vatRate !== undefined) out.vat_rate = payload.vatRate;
  if (payload.sortOrder !== undefined) out.sort_order = payload.sortOrder;

  if (Object.keys(out).length === 0) {
    throw new ApiError(400, "ALPI-CAT-VAL-315", "At least one field is required for update.");
  }

  return out;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ categoryId: string }> }) {
  try {
    const tenant = await getTenantFromRequest(request);
    const actor = await getRequestActor(request, tenant.id);

    await assertFeatureEnabled(tenant, "inventory");
    await assertPermissionAndScope({
      tenantId: tenant.id,
      roleId: actor.roleId,
      permissionKey: "categories.update",
      actorPrimaryBranchId: actor.primaryBranchId,
      actorAssignedBranchIds: actor.assignedBranchIds,
    });

    const { categoryId } = await params;
    const supabase = createAdminClient();

    const { data: existing, error: readError } = await supabase
      .from("categories")
      .select("id,tenant_id")
      .eq("id", categoryId)
      .single();

    if (readError || !existing?.id) throw new ApiError(404, "ALPI-CAT-NOTF-316", "Category not found.");
    if (existing.tenant_id !== tenant.id) throw new ApiError(403, "ALPI-CAT-PERM-317", "Cannot update category from another tenant.");

    const updates = normalizeUpdate((await request.json()) as Partial<UpdateCategoryPayload>);

    if (updates.parent_id && updates.parent_id === existing.id) {
      throw new ApiError(400, "ALPI-CAT-VAL-318", "Category parent cannot be itself.");
    }

    if (updates.parent_id) {
      const { data: parent, error: parentError } = await supabase
        .from("categories")
        .select("id,tenant_id,is_active")
        .eq("id", updates.parent_id as string)
        .single();

      if (parentError || !parent?.id) throw new ApiError(404, "ALPI-CAT-NOTF-319", "parent category not found.");
      if (parent.tenant_id !== tenant.id) throw new ApiError(403, "ALPI-CAT-PERM-320", "parent category is from another tenant.");
      if (!parent.is_active) throw new ApiError(400, "ALPI-CAT-STAT-321", "parent category must be active.");
    }

    const { data, error } = await supabase
      .from("categories")
      .update(updates)
      .eq("id", existing.id)
      .select(
        "id,name,parent_id,category_class,stock_behavior,default_tracking_type,product_required,requires_sim,affects_kpi,affects_revenue,vat_rate,sort_order,is_active,created_at",
      )
      .single();

    if (error || !data) {
      const status = error?.code === "23505" ? 409 : 500;
      const code = error?.code === "23505" ? "ALPI-CAT-VAL-322" : "ALPI-CAT-INT-323";
      const message = error?.code === "23505" ? "Category already exists in this scope." : error?.message || "Failed to update category.";
      throw new ApiError(status, code, message);
    }

    return NextResponse.json({ ok: true, item: data });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
