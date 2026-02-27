import { ApiError } from "@/lib/http/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";

export type PermissionCheckInput = {
  tenantId: string;
  roleId: string;
  permissionKey: string;
  requestedBranchId?: string | null;
  actorBranchId?: string | null;
};

export async function assertPermissionAndScope(input: PermissionCheckInput) {
  const supabase = createAdminClient();

  const { data: role, error: roleError } = await supabase
    .from("roles")
    .select("id,tenant_id,is_active")
    .eq("id", input.roleId)
    .single();

  if (roleError || !role?.id || !role.is_active) {
    throw new ApiError(403, "ALPI-PERM-NOTF-042", "Role not found or inactive.");
  }

  if (role.tenant_id !== input.tenantId) {
    throw new ApiError(403, "ALPI-PERM-STAT-043", "Role does not belong to current tenant.");
  }

  const { data: permission, error: permissionError } = await supabase
    .from("permissions")
    .select("id,key")
    .eq("key", input.permissionKey)
    .single();

  if (permissionError || !permission?.id) {
    throw new ApiError(403, "ALPI-PERM-NOTF-044", `Permission not found: ${input.permissionKey}`);
  }

  const { data: rolePermission } = await supabase
    .from("role_permissions")
    .select("scope")
    .eq("role_id", role.id)
    .eq("permission_id", permission.id)
    .maybeSingle();

  if (!rolePermission?.scope) {
    throw new ApiError(403, "ALPI-PERM-PERM-045", `Permission denied: ${input.permissionKey}`);
  }

  const scope = rolePermission.scope as
    | "entire_company"
    | "assigned_region"
    | "assigned_branch"
    | "self_record"
    | "custom_scope";

  if (scope === "entire_company") {
    return { scope };
  }

  if (scope === "assigned_branch") {
    const targetBranch = input.requestedBranchId || input.actorBranchId;

    if (!targetBranch) {
      throw new ApiError(403, "ALPI-PERM-VAL-046", "Branch-scoped permission requires branch context.");
    }

    if (input.actorBranchId && input.requestedBranchId && input.actorBranchId !== input.requestedBranchId) {
      throw new ApiError(403, "ALPI-PERM-PERM-047", "Actor cannot access a different branch scope.");
    }

    return { scope, branchId: targetBranch };
  }

  throw new ApiError(403, "ALPI-PERM-STAT-048", `Scope ${scope} is not implemented in phase 1.`);
}
