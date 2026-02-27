import type { NextRequest } from "next/server";

import { ApiError } from "@/lib/http/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

export type RequestActor = {
  userId: string;
  roleId: string;
  primaryBranchId: string | null;
  assignedBranchIds: string[];
};

function readWithFallback(request: NextRequest, headerKey: string, queryKey: string) {
  return request.headers.get(headerKey)?.trim() || request.nextUrl.searchParams.get(queryKey)?.trim() || "";
}

async function getActorFromSession(tenantId: string): Promise<RequestActor | null> {
  const supabaseServer = await createServerClient();
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();

  if (!user?.id) {
    return null;
  }

  const admin = createAdminClient();

  const { data: tenantUser, error: userError } = await admin
    .from("tenant_users")
    .select("id,role_id,status")
    .eq("tenant_id", tenantId)
    .eq("auth_user_id", user.id)
    .single();

  if (userError || !tenantUser?.id) {
    return null;
  }

  if (tenantUser.status !== "active") {
    throw new ApiError(403, "ALPI-PERM-STAT-049", `User is not active in tenant (status: ${tenantUser.status}).`);
  }

  const { data: branchAssignments } = await admin
    .from("user_branches")
    .select("branch_id,is_primary")
    .eq("tenant_id", tenantId)
    .eq("user_id", tenantUser.id)
    .eq("is_active", true);

  const assignedBranchIds = (branchAssignments ?? []).map((item) => item.branch_id);
  const primaryBranchId = (branchAssignments ?? []).find((item) => item.is_primary)?.branch_id || null;

  return {
    userId: tenantUser.id,
    roleId: tenantUser.role_id,
    primaryBranchId,
    assignedBranchIds,
  };
}

function getActorFromDebugFallback(request: NextRequest): RequestActor {
  const roleId = readWithFallback(request, "x-role-id", "role_id");
  const branchIdRaw = readWithFallback(request, "x-branch-id", "branch_id");

  if (!roleId) {
    throw new ApiError(
      401,
      "ALPI-PERM-VAL-041",
      "Missing actor role context. Use authenticated session or provide x-role-id for bootstrap mode.",
    );
  }

  return {
    userId: "bootstrap-debug-user",
    roleId,
    primaryBranchId: branchIdRaw || null,
    assignedBranchIds: branchIdRaw ? [branchIdRaw] : [],
  };
}

export async function getRequestActor(request: NextRequest, tenantId: string): Promise<RequestActor> {
  const fromSession = await getActorFromSession(tenantId);

  if (fromSession) {
    return fromSession;
  }

  return getActorFromDebugFallback(request);
}
