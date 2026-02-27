import { NextResponse, type NextRequest } from "next/server";

import { getRequestActor } from "@/lib/auth/request-actor";
import { assertPermissionAndScope } from "@/lib/guards/permission-scope";
import { assertFeatureEnabled } from "@/lib/guards/subscription-feature";
import { ApiError, toErrorResponse } from "@/lib/http/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantFromRequest } from "@/lib/tenant/tenant-context";

type AssignablePayload = {
  assignableRoleIds: string[];
};

function validatePayload(payload: Partial<AssignablePayload>): AssignablePayload {
  if (!Array.isArray(payload.assignableRoleIds)) {
    throw new ApiError(400, "ALPI-PERM-VAL-089", "assignableRoleIds array is required.");
  }

  const normalized = payload.assignableRoleIds.map((id) => id.trim()).filter(Boolean);

  return {
    assignableRoleIds: Array.from(new Set(normalized)),
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ roleId: string }> }) {
  try {
    const tenant = await getTenantFromRequest(request);
    const actor = await getRequestActor(request, tenant.id);

    await assertFeatureEnabled(tenant, "users_roles");
    await assertPermissionAndScope({
      tenantId: tenant.id,
      roleId: actor.roleId,
      permissionKey: "role_assignment.manage",
      actorPrimaryBranchId: actor.primaryBranchId,
      actorAssignedBranchIds: actor.assignedBranchIds,
    });

    const { roleId } = await params;
    const supabase = createAdminClient();

    const { data: role, error: roleError } = await supabase
      .from("roles")
      .select("id,tenant_id,name")
      .eq("id", roleId)
      .single();

    if (roleError || !role?.id) {
      throw new ApiError(404, "ALPI-PERM-NOTF-090", "Assigner role not found.");
    }

    if (role.tenant_id !== tenant.id) {
      throw new ApiError(403, "ALPI-PERM-PERM-091", "Assigner role does not belong to tenant.");
    }

    const { data, error } = await supabase
      .from("role_assignment_rules")
      .select("assignable_role_id, assignable_role:roles!role_assignment_rules_assignable_role_id_fkey(id,name,is_active)")
      .eq("tenant_id", tenant.id)
      .eq("assigner_role_id", role.id)
      .order("created_at", { ascending: true });

    if (error) {
      throw new ApiError(500, "ALPI-PERM-INT-092", error.message || "Failed to read assignment rules.");
    }

    return NextResponse.json({
      ok: true,
      assignerRole: role,
      count: data?.length ?? 0,
      items: data ?? [],
    });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ roleId: string }> }) {
  try {
    const tenant = await getTenantFromRequest(request);
    const actor = await getRequestActor(request, tenant.id);

    await assertFeatureEnabled(tenant, "users_roles");
    await assertPermissionAndScope({
      tenantId: tenant.id,
      roleId: actor.roleId,
      permissionKey: "role_assignment.manage",
      actorPrimaryBranchId: actor.primaryBranchId,
      actorAssignedBranchIds: actor.assignedBranchIds,
    });

    const { roleId } = await params;
    const payload = validatePayload((await request.json()) as Partial<AssignablePayload>);
    const supabase = createAdminClient();

    const { data: assignerRole, error: assignerError } = await supabase
      .from("roles")
      .select("id,tenant_id,is_active")
      .eq("id", roleId)
      .single();

    if (assignerError || !assignerRole?.id) {
      throw new ApiError(404, "ALPI-PERM-NOTF-093", "Assigner role not found.");
    }

    if (assignerRole.tenant_id !== tenant.id) {
      throw new ApiError(403, "ALPI-PERM-PERM-094", "Assigner role does not belong to tenant.");
    }

    if (!assignerRole.is_active) {
      throw new ApiError(400, "ALPI-PERM-STAT-095", "Cannot manage rules for inactive assigner role.");
    }

    if (payload.assignableRoleIds.length > 0) {
      const { data: targetRoles } = await supabase
        .from("roles")
        .select("id")
        .eq("tenant_id", tenant.id)
        .in("id", payload.assignableRoleIds);

      const existing = new Set((targetRoles ?? []).map((r) => r.id));
      const missing = payload.assignableRoleIds.filter((id) => !existing.has(id));

      if (missing.length > 0) {
        throw new ApiError(400, "ALPI-PERM-NOTF-096", `Assignable role ids not found: ${missing.join(", ")}`);
      }
    }

    const { error: deleteError } = await supabase
      .from("role_assignment_rules")
      .delete()
      .eq("tenant_id", tenant.id)
      .eq("assigner_role_id", assignerRole.id);

    if (deleteError) {
      throw new ApiError(500, "ALPI-PERM-INT-097", deleteError.message || "Failed to clear role assignment rules.");
    }

    if (payload.assignableRoleIds.length > 0) {
      const inserts = payload.assignableRoleIds.map((assignableRoleId) => ({
        tenant_id: tenant.id,
        assigner_role_id: assignerRole.id,
        assignable_role_id: assignableRoleId,
      }));

      const { error: insertError } = await supabase.from("role_assignment_rules").insert(inserts);

      if (insertError) {
        throw new ApiError(500, "ALPI-PERM-INT-098", insertError.message || "Failed to save role assignment rules.");
      }
    }

    return NextResponse.json({
      ok: true,
      assignerRoleId: assignerRole.id,
      updatedCount: payload.assignableRoleIds.length,
    });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
