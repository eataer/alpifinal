import { NextResponse, type NextRequest } from "next/server";

import { getRequestActor } from "@/lib/auth/request-actor";
import { assertPermissionAndScope } from "@/lib/guards/permission-scope";
import { assertFeatureEnabled } from "@/lib/guards/subscription-feature";
import { ApiError, toErrorResponse } from "@/lib/http/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantFromRequest } from "@/lib/tenant/tenant-context";

export const dynamic = "force-dynamic";

type CreateProductPayload = {
  name?: string;
  categoryId?: string;
  brandId?: string | null;
  model?: string | null;
  sku?: string;
  barcode?: string | null;
  trackingType?: "none" | "serial" | "imei" | "iccid";
  salePrice?: number | null;
  minSalePrice?: number | null;
  costPrice?: number | null;
  vatRate?: number | null;
};

const trackingSet = new Set(["none", "serial", "imei", "iccid"]);

function normalizePayload(payload: Partial<CreateProductPayload>) {
  const name = payload.name?.trim();
  const sku = payload.sku?.trim();
  const categoryId = payload.categoryId?.trim();

  if (!name) throw new ApiError(400, "ALPI-PRD-VAL-501", "name is required.");
  if (!sku) throw new ApiError(400, "ALPI-PRD-VAL-502", "sku is required.");
  if (!categoryId) throw new ApiError(400, "ALPI-PRD-VAL-503", "categoryId is required.");

  const trackingType = payload.trackingType?.trim() || "none";
  if (!trackingSet.has(trackingType)) throw new ApiError(400, "ALPI-PRD-VAL-504", "trackingType is invalid.");

  return {
    name,
    category_id: categoryId,
    brand_id: payload.brandId?.trim() || null,
    model: payload.model?.trim() || null,
    sku,
    barcode: payload.barcode?.trim() || null,
    tracking_type: trackingType,
    sale_price: payload.salePrice ?? null,
    min_sale_price: payload.minSalePrice ?? null,
    cost_price: payload.costPrice ?? null,
    vat_rate: payload.vatRate ?? null,
  };
}

async function assertCategoryAndBrand(supabase: ReturnType<typeof createAdminClient>, tenantId: string, categoryId: string, brandId: string | null) {
  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("id,tenant_id,is_active,default_tracking_type")
    .eq("id", categoryId)
    .single();

  if (categoryError || !category?.id) throw new ApiError(404, "ALPI-PRD-NOTF-505", "Category not found.");
  if (category.tenant_id !== tenantId) throw new ApiError(403, "ALPI-PRD-PERM-506", "Category is from another tenant.");
  if (!category.is_active) throw new ApiError(400, "ALPI-PRD-STAT-507", "Category must be active.");

  if (brandId) {
    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .select("id,tenant_id,is_active")
      .eq("id", brandId)
      .single();

    if (brandError || !brand?.id) throw new ApiError(404, "ALPI-PRD-NOTF-508", "Brand not found.");
    if (brand.tenant_id !== tenantId) throw new ApiError(403, "ALPI-PRD-PERM-509", "Brand is from another tenant.");
    if (!brand.is_active) throw new ApiError(400, "ALPI-PRD-STAT-510", "Brand must be active.");
  }

  return category;
}

export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(request);
    const actor = await getRequestActor(request, tenant.id);

    await assertFeatureEnabled(tenant, "inventory");
    const permission = await assertPermissionAndScope({
      tenantId: tenant.id,
      roleId: actor.roleId,
      permissionKey: "products.view",
      actorPrimaryBranchId: actor.primaryBranchId,
      actorAssignedBranchIds: actor.assignedBranchIds,
    });

    const includeInactive = request.nextUrl.searchParams.get("include_inactive") === "true";
    const categoryId = request.nextUrl.searchParams.get("category_id");
    const brandId = request.nextUrl.searchParams.get("brand_id");
    const trackingType = request.nextUrl.searchParams.get("tracking_type");
    const q = request.nextUrl.searchParams.get("q")?.trim();

    const supabase = createAdminClient();

    let query = supabase
      .from("products")
      .select("id,name,category_id,brand_id,model,sku,barcode,tracking_type,sale_price,min_sale_price,cost_price,last_cost_price,vat_rate,is_active,created_at")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false });

    if (!includeInactive) query = query.eq("is_active", true);
    if (categoryId) query = query.eq("category_id", categoryId);
    if (brandId) query = query.eq("brand_id", brandId);
    if (trackingType && trackingSet.has(trackingType)) query = query.eq("tracking_type", trackingType);
    if (q) query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,barcode.ilike.%${q}%`);

    const { data, error } = await query;
    if (error) throw new ApiError(500, "ALPI-PRD-INT-511", error.message || "Failed to list products.");

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
      permissionKey: "products.create",
      actorPrimaryBranchId: actor.primaryBranchId,
      actorAssignedBranchIds: actor.assignedBranchIds,
    });

    const payload = normalizePayload((await request.json()) as Partial<CreateProductPayload>);
    const supabase = createAdminClient();

    const category = await assertCategoryAndBrand(supabase, tenant.id, payload.category_id, payload.brand_id);
    const trackingType = payload.tracking_type || (category.default_tracking_type as string);

    const { data, error } = await supabase
      .from("products")
      .insert({
        tenant_id: tenant.id,
        ...payload,
        tracking_type: trackingType,
      })
      .select(
        "id,name,category_id,brand_id,model,sku,barcode,tracking_type,sale_price,min_sale_price,cost_price,last_cost_price,vat_rate,is_active,created_at",
      )
      .single();

    if (error || !data) {
      const status = error?.code === "23505" ? 409 : 500;
      const code = error?.code === "23505" ? "ALPI-PRD-VAL-512" : "ALPI-PRD-INT-513";
      const message = error?.code === "23505" ? "SKU or barcode already exists." : error?.message || "Failed to create product.";
      throw new ApiError(status, code, message);
    }

    return NextResponse.json({ ok: true, item: data }, { status: 201 });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
