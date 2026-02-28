import { NextResponse, type NextRequest } from "next/server";

import { getRequestActor } from "@/lib/auth/request-actor";
import { assertPermissionAndScope } from "@/lib/guards/permission-scope";
import { assertFeatureEnabled } from "@/lib/guards/subscription-feature";
import { ApiError, toErrorResponse } from "@/lib/http/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantFromRequest } from "@/lib/tenant/tenant-context";

export const dynamic = "force-dynamic";

type CreateBrandPayload = {
  name?: string;
  sortOrder?: number;
};

function normalizePayload(payload: Partial<CreateBrandPayload>) {
  const name = payload.name?.trim();
  if (!name) throw new ApiError(400, "ALPI-BRD-VAL-401", "name is required.");

  return {
    name,
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
      permissionKey: "brands.view",
      actorPrimaryBranchId: actor.primaryBranchId,
      actorAssignedBranchIds: actor.assignedBranchIds,
    });

    const includeInactive = request.nextUrl.searchParams.get("include_inactive") === "true";
    const supabase = createAdminClient();

    let query = supabase
      .from("brands")
      .select("id,name,sort_order,is_active,created_at")
      .eq("tenant_id", tenant.id)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (!includeInactive) query = query.eq("is_active", true);

    const { data, error } = await query;
    if (error) throw new ApiError(500, "ALPI-BRD-INT-402", error.message || "Failed to list brands.");

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
      permissionKey: "brands.create",
      actorPrimaryBranchId: actor.primaryBranchId,
      actorAssignedBranchIds: actor.assignedBranchIds,
    });

    const payload = normalizePayload((await request.json()) as Partial<CreateBrandPayload>);
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("brands")
      .insert({
        tenant_id: tenant.id,
        ...payload,
      })
      .select("id,name,sort_order,is_active,created_at")
      .single();

    if (error || !data) {
      const status = error?.code === "23505" ? 409 : 500;
      const code = error?.code === "23505" ? "ALPI-BRD-VAL-403" : "ALPI-BRD-INT-404";
      const message = error?.code === "23505" ? "Brand already exists." : error?.message || "Failed to create brand.";
      throw new ApiError(status, code, message);
    }

    return NextResponse.json({ ok: true, item: data }, { status: 201 });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
