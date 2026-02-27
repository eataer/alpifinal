import { NextResponse, type NextRequest } from "next/server";

import { getRequestActor } from "@/lib/auth/request-actor";
import { assertPermissionAndScope } from "@/lib/guards/permission-scope";
import { assertFeatureEnabled } from "@/lib/guards/subscription-feature";
import { ApiError, toErrorResponse } from "@/lib/http/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantFromRequest } from "@/lib/tenant/tenant-context";

const allowedScopes = new Set([
  "entire_company",
  "assigned_region",
  "assigned_branch",
  "self_record",
  "custom_scope",
]);

type ManagePayload = {
  items: Array<{
    permissionKey: string;
    scope: string;
  }>;
};

function validatePayload(payload: Partial<ManagePayload>): ManagePayload {
  if (!Array.isArray(payload.items)) {
    throw new ApiError(400, "ALPI-PERM-VAL-053", "items array is required.");
  }

  if (payload.items.length === 0) {
    throw new ApiError(400, "ALPI-PERM-VAL-054", "items cannot be empty.");
  }

  const normalized = payload.items.map((item, idx) => {
    const permissionKey = item.permissionKey?.trim();
    const scope = item.scope?.trim();

    if (!permissionKey) {
      throw new ApiError(400, "ALPI-PERM-VAL-055", `items[${idx}].permissionKey is required.`);
    }

    if (!scope || !allowedScopes.has(scope)) {
      throw new ApiError(400, "ALPI-PERM-VAL-056", `items[${idx}].scope is invalid.`);
    }

    return { permissionKey, scope };
  });

  return { items: normalized };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ roleId: string }> }) {
  try {
    const tenant = await getTenantFromRequest(request);
    const actor = await getRequestActor(request, tenant.id);

    await assertFeatureEnabled(tenant, "users_roles");
    await assertPermissionAndScope({
      tenantId: tenant.id,
      roleId: actor.roleId,
      permissionKey: "role_permissions.view",
      actorPrimaryBranchId: actor.primaryBranchId,
      actorAssignedBranchIds: actor.assignedBranchIds,
    });

    const { roleId } = await params;
    const supabase = createAdminClient();

    const { data: role, error: roleError } = await supabase
      .from("roles")
      .select("id,tenant_id,name,is_active")
      .eq("id", roleId)
      .single();

    if (roleError || !role?.id) {
      throw new ApiError(404, "ALPI-PERM-NOTF-086", "Role not found.");
    }

    if (role.tenant_id !== tenant.id) {
      throw new ApiError(403, "ALPI-PERM-PERM-087", "Cannot view permissions of role from another tenant.");
    }

    const { data, error } = await supabase
      .from("role_permissions")
      .select("scope, permissions:permissions!inner(id,key,resource,action)")
      .eq("role_id", role.id)
      .order("created_at", { ascending: true });

    if (error) {
      throw new ApiError(500, "ALPI-PERM-INT-088", error.message || "Failed to read role permissions.");
    }

    const items = (data ?? []).map((row) => ({
      scope: row.scope,
      permission: Array.isArray(row.permissions) ? row.permissions[0] : row.permissions,
    }));

    return NextResponse.json({
      ok: true,
      role: {
        id: role.id,
        name: role.name,
        isActive: role.is_active,
      },
      count: items.length,
      items,
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
      permissionKey: "role_permissions.manage",
      actorPrimaryBranchId: actor.primaryBranchId,
      actorAssignedBranchIds: actor.assignedBranchIds,
    });

    const { roleId } = await params;
    const payload = validatePayload((await request.json()) as Partial<ManagePayload>);

    const supabase = createAdminClient();

    const { data: role, error: roleError } = await supabase
      .from("roles")
      .select("id,tenant_id,is_active")
      .eq("id", roleId)
      .single();

    if (roleError || !role?.id) {
      throw new ApiError(404, "ALPI-PERM-NOTF-057", "Target role not found.");
    }

    if (role.tenant_id !== tenant.id) {
      throw new ApiError(403, "ALPI-PERM-PERM-058", "Cannot manage role from another tenant.");
    }

    if (!role.is_active) {
      throw new ApiError(400, "ALPI-PERM-STAT-059", "Cannot manage permissions for an inactive role.");
    }

    const keys = payload.items.map((item) => item.permissionKey);

    const { data: permissionRows, error: permError } = await supabase
      .from("permissions")
      .select("id,key")
      .in("key", keys);

    if (permError || !permissionRows) {
      throw new ApiError(500, "ALPI-PERM-INT-083", permError?.message || "Failed to read permissions.");
    }

    const foundKeys = new Set(permissionRows.map((row) => row.key));
    const missing = keys.filter((key) => !foundKeys.has(key));

    if (missing.length > 0) {
      throw new ApiError(400, "ALPI-PERM-NOTF-060", `Permission keys not found: ${missing.join(", ")}`);
    }

    const permissionMap = new Map(permissionRows.map((row) => [row.key, row.id]));

    const inserts = payload.items.map((item) => ({
      role_id: role.id,
      permission_id: permissionMap.get(item.permissionKey)!,
      scope: item.scope,
    }));

    const { error: deleteError } = await supabase.from("role_permissions").delete().eq("role_id", role.id);

    if (deleteError) {
      throw new ApiError(500, "ALPI-PERM-INT-084", deleteError.message || "Failed to clear role permissions.");
    }

    const { error: insertError } = await supabase.from("role_permissions").insert(inserts);

    if (insertError) {
      throw new ApiError(500, "ALPI-PERM-INT-085", insertError.message || "Failed to save role permissions.");
    }

    return NextResponse.json({
      ok: true,
      roleId: role.id,
      updatedCount: inserts.length,
    });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
