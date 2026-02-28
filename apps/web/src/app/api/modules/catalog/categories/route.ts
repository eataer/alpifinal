import { NextResponse, type NextRequest } from "next/server";

import { getRequestActor } from "@/lib/auth/request-actor";
import { assertPermissionAndScope } from "@/lib/guards/permission-scope";
import { assertFeatureEnabled } from "@/lib/guards/subscription-feature";
import { ApiError, toErrorResponse } from "@/lib/http/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantFromRequest } from "@/lib/tenant/tenant-context";

export const dynamic = "force-dynamic";

type CreateCategoryPayload = {
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

function normalizePayload(payload: Partial<CreateCategoryPayload>) {
  const name = payload.name?.trim();
  if (!name) throw new ApiError(400, "ALPI-CAT-VAL-301", "name is required.");

  const categoryClass = payload.categoryClass?.trim() || "product";
  const stockBehavior = payload.stockBehavior?.trim() || "none";
  const defaultTrackingType = payload.defaultTrackingType?.trim() || "none";

  if (!categoryClassSet.has(categoryClass)) {
    throw new ApiError(400, "ALPI-CAT-VAL-302", "categoryClass is invalid.");
  }
  if (!stockBehaviorSet.has(stockBehavior)) {
    throw new ApiError(400, "ALPI-CAT-VAL-303", "stockBehavior is invalid.");
  }
  if (!trackingSet.has(defaultTrackingType)) {
    throw new ApiError(400, "ALPI-CAT-VAL-304", "defaultTrackingType is invalid.");
  }

  return {
    name,
    parent_id: payload.parentId?.trim() || null,
    category_class: categoryClass,
    stock_behavior: stockBehavior,
    default_tracking_type: defaultTrackingType,
    product_required: payload.productRequired ?? false,
    requires_sim: payload.requiresSim ?? false,
    affects_kpi: payload.affectsKpi ?? true,
    affects_revenue: payload.affectsRevenue ?? true,
    vat_rate: payload.vatRate ?? null,
    sort_order: payload.sortOrder ?? 0,
  };
}

export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(request);
    const actor = await getRequestActor(request, tenant.id);

    await assertFeatureEnabled(tenant, "inventory");
    const permission = await assertPermissionAndScope({
      tenantId: tenant.id,
      roleId: actor.roleId,
      permissionKey: "categories.view",
      actorPrimaryBranchId: actor.primaryBranchId,
      actorAssignedBranchIds: actor.assignedBranchIds,
    });

    const includeInactive = request.nextUrl.searchParams.get("include_inactive") === "true";
    const supabase = createAdminClient();

    let query = supabase
      .from("categories")
      .select(
        "id,name,parent_id,category_class,stock_behavior,default_tracking_type,product_required,requires_sim,affects_kpi,affects_revenue,vat_rate,sort_order,is_active,created_at",
      )
      .eq("tenant_id", tenant.id)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (!includeInactive) query = query.eq("is_active", true);

    const { data, error } = await query;
    if (error) throw new ApiError(500, "ALPI-CAT-INT-305", error.message || "Failed to list categories.");

    return NextResponse.json({
      ok: true,
      scope: permission.scope,
      count: data?.length || 0,
      items: data || [],
    });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(request);
    const actor = await getRequestActor(request, tenant.id);

    await assertFeatureEnabled(tenant, "inventory");
    await assertPermissionAndScope({
      tenantId: tenant.id,
      roleId: actor.roleId,
      permissionKey: "categories.create",
      actorPrimaryBranchId: actor.primaryBranchId,
      actorAssignedBranchIds: actor.assignedBranchIds,
    });

    const payload = normalizePayload((await request.json()) as Partial<CreateCategoryPayload>);
    const supabase = createAdminClient();

    if (payload.parent_id) {
      const { data: parent, error: parentError } = await supabase
        .from("categories")
        .select("id,tenant_id,is_active")
        .eq("id", payload.parent_id)
        .single();

      if (parentError || !parent?.id) throw new ApiError(404, "ALPI-CAT-NOTF-306", "parent category not found.");
      if (parent.tenant_id !== tenant.id) throw new ApiError(403, "ALPI-CAT-PERM-307", "parent category is from another tenant.");
      if (!parent.is_active) throw new ApiError(400, "ALPI-CAT-STAT-308", "parent category must be active.");
    }

    const { data, error } = await supabase
      .from("categories")
      .insert({
        tenant_id: tenant.id,
        ...payload,
      })
      .select(
        "id,name,parent_id,category_class,stock_behavior,default_tracking_type,product_required,requires_sim,affects_kpi,affects_revenue,vat_rate,sort_order,is_active,created_at",
      )
      .single();

    if (error || !data) {
      const status = error?.code === "23505" ? 409 : 500;
      const code = error?.code === "23505" ? "ALPI-CAT-VAL-309" : "ALPI-CAT-INT-310";
      const message = error?.code === "23505" ? "Category already exists in this scope." : error?.message || "Failed to create category.";
      throw new ApiError(status, code, message);
    }

    return NextResponse.json({ ok: true, item: data }, { status: 201 });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
