import { NextResponse, type NextRequest } from "next/server";

import { getRequestActor } from "@/lib/auth/request-actor";
import { assertPermissionAndScope } from "@/lib/guards/permission-scope";
import { assertFeatureEnabled } from "@/lib/guards/subscription-feature";
import { ApiError, toErrorResponse } from "@/lib/http/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantFromRequest } from "@/lib/tenant/tenant-context";

type CreateBranchPayload = {
  name: string;
  code: string;
  address?: string;
  phone?: string;
};

function validateCreatePayload(payload: Partial<CreateBranchPayload>): CreateBranchPayload {
  const name = payload.name?.trim();
  const code = payload.code?.trim();

  if (!name) {
    throw new ApiError(400, "ALPI-BRCH-VAL-109", "name is required.");
  }

  if (!code) {
    throw new ApiError(400, "ALPI-BRCH-VAL-110", "code is required.");
  }

  if (code.length < 2 || code.length > 20 || /\s/.test(code)) {
    throw new ApiError(400, "ALPI-BRCH-VAL-111", "code must be 2-20 chars and cannot contain spaces.");
  }

  return {
    name,
    code,
    address: payload.address?.trim() || undefined,
    phone: payload.phone?.trim() || undefined,
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
      permissionKey: "branches.view",
      requestedBranchId: request.nextUrl.searchParams.get("branch_id"),
      actorPrimaryBranchId: actor.primaryBranchId,
      actorAssignedBranchIds: actor.assignedBranchIds,
    });

    const supabase = createAdminClient();

    let query = supabase
      .from("branches")
      .select("id,name,code,address,phone,is_active,created_at")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false });

    if (permission.scope === "assigned_branch" && permission.branchId) {
      query = query.eq("id", permission.branchId);
    } else {
      query = query.limit(100);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      ok: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
      },
      scope: permission.scope,
      count: data?.length ?? 0,
      items: data ?? [],
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
      permissionKey: "branches.create",
      actorPrimaryBranchId: actor.primaryBranchId,
      actorAssignedBranchIds: actor.assignedBranchIds,
    });

    const payload = validateCreatePayload((await request.json()) as Partial<CreateBranchPayload>);
    const supabase = createAdminClient();

    const { data: tenantLimits } = await supabase
      .from("tenants")
      .select("max_branches")
      .eq("id", tenant.id)
      .single();

    const maxBranches = tenantLimits?.max_branches ?? null;

    if (maxBranches !== null && maxBranches !== -1) {
      const { count: activeCount, error: countError } = await supabase
        .from("branches")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .eq("is_active", true);

      if (countError) {
        throw new ApiError(500, "ALPI-BRCH-INT-112", countError.message || "Failed to read active branch count.");
      }

      if ((activeCount ?? 0) + 1 > maxBranches) {
        throw new ApiError(
          403,
          "ALPI-BRCH-LIM-113",
          `Active branch limit exceeded (${activeCount}/${maxBranches}).`,
        );
      }
    }

    const { data, error } = await supabase
      .from("branches")
      .insert({
        tenant_id: tenant.id,
        name: payload.name,
        code: payload.code,
        address: payload.address ?? null,
        phone: payload.phone ?? null,
        is_active: true,
      })
      .select("id,name,code,address,phone,is_active,created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new ApiError(409, "ALPI-BRCH-CON-114", "Branch code already exists in tenant.");
      }
      throw new ApiError(500, "ALPI-BRCH-INT-115", error.message || "Failed to create branch.");
    }

    return NextResponse.json({
      ok: true,
      item: data,
    });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
