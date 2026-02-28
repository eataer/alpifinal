import { NextResponse, type NextRequest } from "next/server";

import { getRequestActor } from "@/lib/auth/request-actor";
import { assertPermissionAndScope } from "@/lib/guards/permission-scope";
import { assertFeatureEnabled } from "@/lib/guards/subscription-feature";
import { ApiError, toErrorResponse } from "@/lib/http/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantFromRequest } from "@/lib/tenant/tenant-context";

type UpdateBrandPayload = {
  name?: string;
  sortOrder?: number;
};

function normalizeUpdate(payload: Partial<UpdateBrandPayload>) {
  const out: Record<string, string | number> = {};

  if (payload.name !== undefined) {
    const name = payload.name.trim();
    if (!name) throw new ApiError(400, "ALPI-BRD-VAL-405", "name cannot be empty.");
    out.name = name;
  }
  if (payload.sortOrder !== undefined) out.sort_order = payload.sortOrder;

  if (Object.keys(out).length === 0) {
    throw new ApiError(400, "ALPI-BRD-VAL-406", "At least one field is required for update.");
  }

  return out;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  try {
    const tenant = await getTenantFromRequest(request);
    const actor = await getRequestActor(request, tenant.id);

    await assertFeatureEnabled(tenant, "inventory");
    await assertPermissionAndScope({
      tenantId: tenant.id,
      roleId: actor.roleId,
      permissionKey: "brands.update",
      actorPrimaryBranchId: actor.primaryBranchId,
      actorAssignedBranchIds: actor.assignedBranchIds,
    });

    const { brandId } = await params;
    const supabase = createAdminClient();

    const { data: existing, error: readError } = await supabase
      .from("brands")
      .select("id,tenant_id")
      .eq("id", brandId)
      .single();

    if (readError || !existing?.id) throw new ApiError(404, "ALPI-BRD-NOTF-407", "Brand not found.");
    if (existing.tenant_id !== tenant.id) throw new ApiError(403, "ALPI-BRD-PERM-408", "Cannot update brand from another tenant.");

    const updates = normalizeUpdate((await request.json()) as Partial<UpdateBrandPayload>);

    const { data, error } = await supabase
      .from("brands")
      .update(updates)
      .eq("id", existing.id)
      .select("id,name,sort_order,is_active,created_at")
      .single();

    if (error || !data) {
      const status = error?.code === "23505" ? 409 : 500;
      const code = error?.code === "23505" ? "ALPI-BRD-VAL-409" : "ALPI-BRD-INT-410";
      const message = error?.code === "23505" ? "Brand already exists." : error?.message || "Failed to update brand.";
      throw new ApiError(status, code, message);
    }

    return NextResponse.json({ ok: true, item: data });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  try {
    const tenant = await getTenantFromRequest(request);
    const actor = await getRequestActor(request, tenant.id);

    await assertFeatureEnabled(tenant, "inventory");
    await assertPermissionAndScope({
      tenantId: tenant.id,
      roleId: actor.roleId,
      permissionKey: "brands.delete",
      actorPrimaryBranchId: actor.primaryBranchId,
      actorAssignedBranchIds: actor.assignedBranchIds,
    });

    const { brandId } = await params;
    const supabase = createAdminClient();

    const { data: existing, error: readError } = await supabase
      .from("brands")
      .select("id,tenant_id,name")
      .eq("id", brandId)
      .single();

    if (readError || !existing?.id) throw new ApiError(404, "ALPI-BRD-NOTF-411", "Brand not found.");
    if (existing.tenant_id !== tenant.id) throw new ApiError(403, "ALPI-BRD-PERM-412", "Cannot delete brand from another tenant.");

    const { count: productCount, error: productCountError } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .eq("brand_id", existing.id);

    if (productCountError) {
      throw new ApiError(500, "ALPI-BRD-INT-413", productCountError.message || "Failed to check brand usage.");
    }

    if ((productCount || 0) > 0) {
      throw new ApiError(
        400,
        "ALPI-BRD-STAT-414",
        `Brand is used by ${productCount} product(s). Use deactivate instead of delete.`,
      );
    }

    const { error: deleteError } = await supabase.from("brands").delete().eq("id", existing.id);
    if (deleteError) throw new ApiError(500, "ALPI-BRD-INT-415", deleteError.message || "Failed to delete brand.");

    return NextResponse.json({ ok: true, deleted: true, id: existing.id, name: existing.name });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
