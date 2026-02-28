import { NextResponse, type NextRequest } from "next/server";

import { getRequestActor } from "@/lib/auth/request-actor";
import { assertPermissionAndScope } from "@/lib/guards/permission-scope";
import { assertFeatureEnabled } from "@/lib/guards/subscription-feature";
import { ApiError, toErrorResponse } from "@/lib/http/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantFromRequest } from "@/lib/tenant/tenant-context";

type UpdateProductPayload = {
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

function normalizeUpdate(payload: Partial<UpdateProductPayload>) {
  const out: Record<string, string | number | null> = {};

  if (payload.name !== undefined) {
    const name = payload.name.trim();
    if (!name) throw new ApiError(400, "ALPI-PRD-VAL-514", "name cannot be empty.");
    out.name = name;
  }

  if (payload.categoryId !== undefined) {
    const id = payload.categoryId.trim();
    if (!id) throw new ApiError(400, "ALPI-PRD-VAL-515", "categoryId cannot be empty.");
    out.category_id = id;
  }
  if (payload.brandId !== undefined) out.brand_id = payload.brandId?.trim() || null;
  if (payload.model !== undefined) out.model = payload.model?.trim() || null;
  if (payload.sku !== undefined) {
    const sku = payload.sku.trim();
    if (!sku) throw new ApiError(400, "ALPI-PRD-VAL-516", "sku cannot be empty.");
    out.sku = sku;
  }
  if (payload.barcode !== undefined) out.barcode = payload.barcode?.trim() || null;
  if (payload.trackingType !== undefined) {
    if (!trackingSet.has(payload.trackingType)) throw new ApiError(400, "ALPI-PRD-VAL-517", "trackingType is invalid.");
    out.tracking_type = payload.trackingType;
  }
  if (payload.salePrice !== undefined) out.sale_price = payload.salePrice;
  if (payload.minSalePrice !== undefined) out.min_sale_price = payload.minSalePrice;
  if (payload.costPrice !== undefined) out.cost_price = payload.costPrice;
  if (payload.vatRate !== undefined) out.vat_rate = payload.vatRate;

  if (Object.keys(out).length === 0) {
    throw new ApiError(400, "ALPI-PRD-VAL-518", "At least one field is required for update.");
  }

  return out;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  try {
    const tenant = await getTenantFromRequest(request);
    const actor = await getRequestActor(request, tenant.id);

    await assertFeatureEnabled(tenant, "inventory");
    await assertPermissionAndScope({
      tenantId: tenant.id,
      roleId: actor.roleId,
      permissionKey: "products.update",
      actorPrimaryBranchId: actor.primaryBranchId,
      actorAssignedBranchIds: actor.assignedBranchIds,
    });

    const { productId } = await params;
    const supabase = createAdminClient();

    const { data: existing, error: readError } = await supabase
      .from("products")
      .select("id,tenant_id,category_id")
      .eq("id", productId)
      .single();

    if (readError || !existing?.id) throw new ApiError(404, "ALPI-PRD-NOTF-519", "Product not found.");
    if (existing.tenant_id !== tenant.id) throw new ApiError(403, "ALPI-PRD-PERM-520", "Cannot update product from another tenant.");

    const updates = normalizeUpdate((await request.json()) as Partial<UpdateProductPayload>);

    const categoryId = (updates.category_id as string | undefined) || existing.category_id;
    const brandId = (updates.brand_id as string | null | undefined) ?? undefined;

    const { data: category, error: categoryError } = await supabase
      .from("categories")
      .select("id,tenant_id,is_active")
      .eq("id", categoryId)
      .single();

    if (categoryError || !category?.id) throw new ApiError(404, "ALPI-PRD-NOTF-521", "Category not found.");
    if (category.tenant_id !== tenant.id || !category.is_active) {
      throw new ApiError(400, "ALPI-PRD-STAT-522", "Category must be active and belong to tenant.");
    }

    if (brandId) {
      const { data: brand, error: brandError } = await supabase
        .from("brands")
        .select("id,tenant_id,is_active")
        .eq("id", brandId)
        .single();

      if (brandError || !brand?.id) throw new ApiError(404, "ALPI-PRD-NOTF-523", "Brand not found.");
      if (brand.tenant_id !== tenant.id || !brand.is_active) {
        throw new ApiError(400, "ALPI-PRD-STAT-524", "Brand must be active and belong to tenant.");
      }
    }

    const { data, error } = await supabase
      .from("products")
      .update(updates)
      .eq("id", existing.id)
      .select(
        "id,name,category_id,brand_id,model,sku,barcode,tracking_type,sale_price,min_sale_price,cost_price,last_cost_price,vat_rate,is_active,created_at",
      )
      .single();

    if (error || !data) {
      const status = error?.code === "23505" ? 409 : 500;
      const code = error?.code === "23505" ? "ALPI-PRD-VAL-525" : "ALPI-PRD-INT-526";
      const message = error?.code === "23505" ? "SKU or barcode already exists." : error?.message || "Failed to update product.";
      throw new ApiError(status, code, message);
    }

    return NextResponse.json({ ok: true, item: data });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
