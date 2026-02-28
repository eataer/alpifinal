import { NextResponse, type NextRequest } from "next/server";

import { getRequestActor } from "@/lib/auth/request-actor";
import { assertPermissionAndScope } from "@/lib/guards/permission-scope";
import { assertFeatureEnabled } from "@/lib/guards/subscription-feature";
import { ApiError, toErrorResponse } from "@/lib/http/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantFromRequest } from "@/lib/tenant/tenant-context";

type CreateDepartmentPayload = {
  name?: string;
  code?: string | null;
};

function normalizePayload(payload: Partial<CreateDepartmentPayload>) {
  const name = payload.name?.trim();

  if (!name) {
    throw new ApiError(400, "ALPI-DEPT-VAL-101", "name is required.");
  }

  return {
    name,
    code: payload.code?.trim() || null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(request);
    const actor = await getRequestActor(request, tenant.id);

    await assertFeatureEnabled(tenant, "organization");
    const permission = await assertPermissionAndScope({
      tenantId: tenant.id,
      roleId: actor.roleId,
      permissionKey: "departments.view",
      actorPrimaryBranchId: actor.primaryBranchId,
      actorAssignedBranchIds: actor.assignedBranchIds,
    });

    const includeInactive = request.nextUrl.searchParams.get("include_inactive") === "true";
    const supabase = createAdminClient();

    let query = supabase
      .from("departments")
      .select("id,name,code,is_active,created_at")
      .eq("tenant_id", tenant.id)
      .order("name", { ascending: true });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    if (error) {
      throw new ApiError(500, "ALPI-DEPT-INT-102", error.message || "Failed to list departments.");
    }

    return NextResponse.json({
      ok: true,
      tenant: { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain },
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

    await assertFeatureEnabled(tenant, "organization");
    await assertPermissionAndScope({
      tenantId: tenant.id,
      roleId: actor.roleId,
      permissionKey: "departments.create",
      actorPrimaryBranchId: actor.primaryBranchId,
      actorAssignedBranchIds: actor.assignedBranchIds,
    });

    const payload = normalizePayload((await request.json()) as Partial<CreateDepartmentPayload>);
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("departments")
      .insert({
        tenant_id: tenant.id,
        name: payload.name,
        code: payload.code,
      })
      .select("id,name,code,is_active,created_at")
      .single();

    if (error || !data) {
      const code = error?.code === "23505" ? "ALPI-DEPT-VAL-103" : "ALPI-DEPT-INT-104";
      const message = error?.code === "23505" ? "Department already exists." : error?.message || "Failed to create department.";
      throw new ApiError(error?.code === "23505" ? 409 : 500, code, message);
    }

    return NextResponse.json({ ok: true, item: data }, { status: 201 });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
