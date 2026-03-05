import { NextResponse, type NextRequest } from "next/server";

import { getRequestActor } from "@/lib/auth/request-actor";
import { assertPermissionAndScope } from "@/lib/guards/permission-scope";
import { assertFeatureEnabled } from "@/lib/guards/subscription-feature";
import { ApiError, toErrorResponse } from "@/lib/http/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantFromRequest } from "@/lib/tenant/tenant-context";

export const dynamic = "force-dynamic";

type ImportRow = {
  sku?: string;
  name?: string;
  category_id?: string;
  category_name?: string;
  brand_id?: string;
  brand_name?: string;
  model?: string;
  barcode?: string;
  tracking_type?: "none" | "serial" | "imei" | "iccid";
  sale_price?: number | null;
  min_sale_price?: number | null;
  cost_price?: number | null;
  vat_rate?: number | null;
  is_active?: boolean;
};

type ImportPayload = {
  mode?: "insert_only" | "upsert_by_sku";
  create_missing_brands?: boolean;
  rows?: ImportRow[];
};

const trackingSet = new Set(["none", "serial", "imei", "iccid"]);

function normalizeText(value: string | null | undefined) {
  const v = value?.trim();
  return v ? v : null;
}

function normalizeNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (Number.isNaN(value)) return null;
  return value;
}

export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(request);
    const actor = await getRequestActor(request, tenant.id);

    await assertFeatureEnabled(tenant, "inventory");
    await assertPermissionAndScope({
      tenantId: tenant.id,
      roleId: actor.roleId,
      permissionKey: "products.import",
      actorPrimaryBranchId: actor.primaryBranchId,
      actorAssignedBranchIds: actor.assignedBranchIds,
    });

    const payload = (await request.json()) as ImportPayload;
    const mode = payload.mode || "insert_only";
    const createMissingBrands = payload.create_missing_brands === true;
    const rows = payload.rows || [];

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new ApiError(400, "ALPI-PRD-IMP-601", "rows is required and must not be empty.");
    }
    if (rows.length > 1000) {
      throw new ApiError(400, "ALPI-PRD-IMP-602", "rows limit exceeded. max=1000.");
    }
    if (mode !== "insert_only" && mode !== "upsert_by_sku") {
      throw new ApiError(400, "ALPI-PRD-IMP-603", "mode is invalid.");
    }

    const supabase = createAdminClient();

    const [{ data: categories, error: categoriesError }, { data: brands, error: brandsError }] = await Promise.all([
      supabase.from("categories").select("id,name,is_active").eq("tenant_id", tenant.id),
      supabase.from("brands").select("id,name,is_active").eq("tenant_id", tenant.id),
    ]);

    if (categoriesError) throw new ApiError(500, "ALPI-PRD-IMP-604", categoriesError.message || "Failed to load categories.");
    if (brandsError) throw new ApiError(500, "ALPI-PRD-IMP-605", brandsError.message || "Failed to load brands.");

    const categoryById = new Map((categories || []).map((c) => [c.id, c]));
    const categoryByName = new Map((categories || []).map((c) => [c.name.trim().toLowerCase(), c]));

    const brandById = new Map((brands || []).map((b) => [b.id, b]));
    const brandByName = new Map((brands || []).map((b) => [b.name.trim().toLowerCase(), b]));

    let created = 0;
    let updated = 0;
    let failed = 0;

    const errors: Array<{ row: number; code: string; message: string }> = [];

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const rowNo = i + 1;

      try {
        const sku = normalizeText(row.sku);
        const name = normalizeText(row.name);
        if (!sku) throw new ApiError(400, "ALPI-PRD-IMP-606", "sku is required.");
        if (!name) throw new ApiError(400, "ALPI-PRD-IMP-607", "name is required.");

        const categoryIdInput = normalizeText(row.category_id);
        const categoryNameInput = normalizeText(row.category_name)?.toLowerCase();
        if (!categoryIdInput && !categoryNameInput) {
          throw new ApiError(400, "ALPI-PRD-IMP-608", "category_id or category_name is required.");
        }

        const category = categoryIdInput ? categoryById.get(categoryIdInput) : categoryByName.get(categoryNameInput || "");
        if (!category) throw new ApiError(400, "ALPI-PRD-IMP-609", "Category not found.");
        if (!category.is_active) throw new ApiError(400, "ALPI-PRD-IMP-610", "Category must be active.");

        let brandId: string | null = null;
        const brandIdInput = normalizeText(row.brand_id);
        const brandNameInput = normalizeText(row.brand_name);

        if (brandIdInput) {
          const foundBrand = brandById.get(brandIdInput);
          if (!foundBrand) throw new ApiError(400, "ALPI-PRD-IMP-611", "Brand not found.");
          if (!foundBrand.is_active) throw new ApiError(400, "ALPI-PRD-IMP-612", "Brand must be active.");
          brandId = foundBrand.id;
        } else if (brandNameInput) {
          const key = brandNameInput.toLowerCase();
          let foundBrand = brandByName.get(key);

          if (!foundBrand && createMissingBrands) {
            const { data: createdBrand, error: createBrandError } = await supabase
              .from("brands")
              .insert({
                tenant_id: tenant.id,
                name: brandNameInput,
              })
              .select("id,name,is_active")
              .single();

            if (createBrandError || !createdBrand) {
              throw new ApiError(400, "ALPI-PRD-IMP-613", createBrandError?.message || "Brand create failed.");
            }
            foundBrand = createdBrand;
            brandById.set(foundBrand.id, foundBrand);
            brandByName.set(foundBrand.name.trim().toLowerCase(), foundBrand);
          }

          if (!foundBrand) throw new ApiError(400, "ALPI-PRD-IMP-614", "Brand not found.");
          if (!foundBrand.is_active) throw new ApiError(400, "ALPI-PRD-IMP-615", "Brand must be active.");
          brandId = foundBrand.id;
        }

        const trackingType = normalizeText(row.tracking_type) || "none";
        if (!trackingSet.has(trackingType)) throw new ApiError(400, "ALPI-PRD-IMP-616", "tracking_type is invalid.");

        const dataPayload = {
          tenant_id: tenant.id,
          sku,
          name,
          category_id: category.id,
          brand_id: brandId,
          model: normalizeText(row.model),
          barcode: normalizeText(row.barcode),
          tracking_type: trackingType,
          sale_price: normalizeNumber(row.sale_price),
          min_sale_price: normalizeNumber(row.min_sale_price),
          cost_price: normalizeNumber(row.cost_price),
          vat_rate: normalizeNumber(row.vat_rate),
          is_active: row.is_active ?? true,
        };

        if (mode === "upsert_by_sku") {
          const { data: existing, error: existingError } = await supabase
            .from("products")
            .select("id")
            .eq("tenant_id", tenant.id)
            .eq("sku", sku)
            .maybeSingle();

          if (existingError) throw new ApiError(500, "ALPI-PRD-IMP-617", existingError.message || "Failed to read existing product.");

          if (existing?.id) {
            const { error: updateError } = await supabase.from("products").update(dataPayload).eq("id", existing.id);
            if (updateError) throw new ApiError(400, "ALPI-PRD-IMP-618", updateError.message || "Failed to update product.");
            updated += 1;
            continue;
          }
        }

        const { error: insertError } = await supabase.from("products").insert(dataPayload);
        if (insertError) {
          const duplicate = insertError.code === "23505";
          throw new ApiError(duplicate ? 409 : 400, duplicate ? "ALPI-PRD-IMP-619" : "ALPI-PRD-IMP-620", duplicate ? "SKU or barcode already exists." : insertError.message || "Failed to insert product.");
        }
        created += 1;
      } catch (rowError) {
        failed += 1;
        const mapped = rowError instanceof ApiError ? rowError : new ApiError(400, "ALPI-PRD-IMP-699", rowError instanceof Error ? rowError.message : "Unknown row error.");
        errors.push({ row: rowNo, code: mapped.code, message: mapped.message });
      }
    }

    return NextResponse.json({
      ok: true,
      mode,
      create_missing_brands: createMissingBrands,
      summary: {
        total: rows.length,
        created,
        updated,
        failed,
      },
      errors,
    });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
