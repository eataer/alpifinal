import { NextResponse, type NextRequest } from "next/server";

import { getRequestActor } from "@/lib/auth/request-actor";
import { assertPermissionAndScope } from "@/lib/guards/permission-scope";
import { assertFeatureEnabled } from "@/lib/guards/subscription-feature";
import { ApiError, toErrorResponse } from "@/lib/http/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantFromRequest } from "@/lib/tenant/tenant-context";

type DeactivateOptions = {
  moveUsers?: boolean;
  targetBranchId?: string;
  autoSetPrimaryOnTarget?: boolean;
  suspendUsersWithoutActiveBranch?: boolean;
};

async function assertDeactivateAccess(request: NextRequest) {
  const tenant = await getTenantFromRequest(request);
  const actor = await getRequestActor(request, tenant.id);

  await assertFeatureEnabled(tenant, "organization");
  await assertPermissionAndScope({
    tenantId: tenant.id,
    roleId: actor.roleId,
    permissionKey: "branches.deactivate",
    actorPrimaryBranchId: actor.primaryBranchId,
    actorAssignedBranchIds: actor.assignedBranchIds,
  });

  return { tenant };
}

async function getPreview(tenantId: string, branchId: string) {
  const supabase = createAdminClient();

  const { data: assignments, error: assignmentsError } = await supabase
    .from("user_branches")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .eq("is_active", true);

  if (assignmentsError) {
    throw new ApiError(500, "ALPI-BRCH-INT-124", assignmentsError.message || "Failed to read branch assignments.");
  }

  const uniqueUsers = Array.from(new Set((assignments ?? []).map((a) => a.user_id)));

  let usersWithoutOtherActiveBranch = 0;
  if (uniqueUsers.length > 0) {
    const { data: allUserBranches, error: userBranchError } = await supabase
      .from("user_branches")
      .select("user_id,branch_id,is_active")
      .eq("tenant_id", tenantId)
      .in("user_id", uniqueUsers)
      .eq("is_active", true);

    if (userBranchError) {
      throw new ApiError(500, "ALPI-BRCH-INT-125", userBranchError.message || "Failed to read user branch map.");
    }

    const grouped = new Map<string, Set<string>>();
    (allUserBranches ?? []).forEach((row) => {
      if (!grouped.has(row.user_id)) grouped.set(row.user_id, new Set());
      grouped.get(row.user_id)?.add(row.branch_id);
    });

    usersWithoutOtherActiveBranch = uniqueUsers.filter((userId) => {
      const branches = grouped.get(userId) ?? new Set<string>();
      return branches.size <= 1 && branches.has(branchId);
    }).length;
  }

  return {
    userCount: uniqueUsers.length,
    usersWithoutOtherActiveBranch,
    employeeCount: 0,
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ branchId: string }> }) {
  try {
    const { tenant } = await assertDeactivateAccess(request);
    const { branchId } = await params;
    const supabase = createAdminClient();

    const { data: branch, error: branchError } = await supabase
      .from("branches")
      .select("id,tenant_id,name,code,is_active")
      .eq("id", branchId)
      .single();

    if (branchError || !branch?.id) {
      throw new ApiError(404, "ALPI-BRCH-NOTF-121", "Branch not found.");
    }

    if (branch.tenant_id !== tenant.id) {
      throw new ApiError(403, "ALPI-BRCH-PERM-122", "Cannot access branch from another tenant.");
    }

    const preview = await getPreview(tenant.id, branch.id);

    return NextResponse.json({
      ok: true,
      branch: {
        id: branch.id,
        name: branch.name,
        code: branch.code,
        isActive: branch.is_active,
      },
      preview,
    });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ branchId: string }> }) {
  try {
    const { tenant } = await assertDeactivateAccess(request);

    const { branchId } = await params;
    const supabase = createAdminClient();
    let options: DeactivateOptions = {};

    try {
      options = ((await request.json()) as DeactivateOptions) || {};
    } catch {
      options = {};
    }

    const moveUsers = Boolean(options.moveUsers);
    const targetBranchId = options.targetBranchId?.trim() || null;
    const autoSetPrimaryOnTarget = options.autoSetPrimaryOnTarget !== false;
    const suspendUsersWithoutActiveBranch = options.suspendUsersWithoutActiveBranch !== false;

    const { data: branch, error: branchError } = await supabase
      .from("branches")
      .select("id,tenant_id,is_active")
      .eq("id", branchId)
      .single();

    if (branchError || !branch?.id) {
      throw new ApiError(404, "ALPI-BRCH-NOTF-121", "Branch not found.");
    }

    if (branch.tenant_id !== tenant.id) {
      throw new ApiError(403, "ALPI-BRCH-PERM-122", "Cannot deactivate branch from another tenant.");
    }

    if (!branch.is_active) {
      return NextResponse.json({ ok: true, item: { id: branch.id, is_active: false } });
    }

    if (moveUsers) {
      if (!targetBranchId) {
        throw new ApiError(400, "ALPI-BRCH-VAL-126", "targetBranchId is required when moveUsers is true.");
      }
      if (targetBranchId === branch.id) {
        throw new ApiError(400, "ALPI-BRCH-VAL-127", "targetBranchId cannot be same as source branch.");
      }

      const { data: targetBranch, error: targetError } = await supabase
        .from("branches")
        .select("id,tenant_id,is_active")
        .eq("id", targetBranchId)
        .single();

      if (targetError || !targetBranch?.id) {
        throw new ApiError(404, "ALPI-BRCH-NOTF-128", "Target branch not found.");
      }
      if (targetBranch.tenant_id !== tenant.id) {
        throw new ApiError(403, "ALPI-BRCH-PERM-129", "Target branch does not belong to tenant.");
      }
      if (!targetBranch.is_active) {
        throw new ApiError(400, "ALPI-BRCH-STAT-130", "Target branch must be active.");
      }
    }

    const { data: sourceAssignments, error: sourceAssignmentsError } = await supabase
      .from("user_branches")
      .select("tenant_id,user_id,branch_id,is_primary,is_active")
      .eq("tenant_id", tenant.id)
      .eq("branch_id", branch.id)
      .eq("is_active", true);

    if (sourceAssignmentsError) {
      throw new ApiError(
        500,
        "ALPI-BRCH-INT-131",
        sourceAssignmentsError.message || "Failed to read source assignments.",
      );
    }

    const userIds = Array.from(new Set((sourceAssignments ?? []).map((a) => a.user_id)));

    if (moveUsers && targetBranchId && userIds.length > 0) {
      const { data: existingTargetAssignments } = await supabase
        .from("user_branches")
        .select("user_id")
        .eq("tenant_id", tenant.id)
        .eq("branch_id", targetBranchId)
        .in("user_id", userIds);

      const alreadyAssigned = new Set((existingTargetAssignments ?? []).map((a) => a.user_id));
      const toInsert = userIds
        .filter((uid) => !alreadyAssigned.has(uid))
        .map((uid) => ({
          tenant_id: tenant.id,
          user_id: uid,
          branch_id: targetBranchId,
          is_primary: false,
          is_active: true,
        }));

      if (toInsert.length > 0) {
        const { error: insertTargetError } = await supabase.from("user_branches").insert(toInsert);
        if (insertTargetError) {
          throw new ApiError(500, "ALPI-BRCH-INT-132", insertTargetError.message || "Failed to move users.");
        }
      }

      if (autoSetPrimaryOnTarget) {
        const primaryUsers = (sourceAssignments ?? []).filter((a) => a.is_primary).map((a) => a.user_id);

        if (primaryUsers.length > 0) {
          const { error: clearPrimaryError } = await supabase
            .from("user_branches")
            .update({ is_primary: false })
            .eq("tenant_id", tenant.id)
            .in("user_id", primaryUsers)
            .eq("is_primary", true);

          if (clearPrimaryError) {
            throw new ApiError(500, "ALPI-BRCH-INT-133", clearPrimaryError.message || "Failed to clear primary branch.");
          }

          const { error: setPrimaryError } = await supabase
            .from("user_branches")
            .update({ is_primary: true, is_active: true })
            .eq("tenant_id", tenant.id)
            .eq("branch_id", targetBranchId)
            .in("user_id", primaryUsers);

          if (setPrimaryError) {
            throw new ApiError(500, "ALPI-BRCH-INT-134", setPrimaryError.message || "Failed to set new primary branch.");
          }
        }
      }
    }

    if (userIds.length > 0) {
      const { error: deactivateAssignmentsError } = await supabase
        .from("user_branches")
        .update({ is_active: false, is_primary: false })
        .eq("tenant_id", tenant.id)
        .eq("branch_id", branch.id)
        .in("user_id", userIds);

      if (deactivateAssignmentsError) {
        throw new ApiError(
          500,
          "ALPI-BRCH-INT-135",
          deactivateAssignmentsError.message || "Failed to deactivate source assignments.",
        );
      }
    }

    if (!moveUsers && suspendUsersWithoutActiveBranch && userIds.length > 0) {
      const { data: activeElsewhere, error: activeElsewhereError } = await supabase
        .from("user_branches")
        .select("user_id")
        .eq("tenant_id", tenant.id)
        .eq("is_active", true)
        .in("user_id", userIds);

      if (activeElsewhereError) {
        throw new ApiError(500, "ALPI-BRCH-INT-136", activeElsewhereError.message || "Failed to evaluate user state.");
      }

      const hasActive = new Set((activeElsewhere ?? []).map((r) => r.user_id));
      const toSuspend = userIds.filter((uid) => !hasActive.has(uid));

      if (toSuspend.length > 0) {
        const { error: suspendError } = await supabase
          .from("tenant_users")
          .update({ status: "suspended" })
          .eq("tenant_id", tenant.id)
          .in("id", toSuspend);

        if (suspendError) {
          throw new ApiError(500, "ALPI-BRCH-INT-137", suspendError.message || "Failed to suspend users.");
        }
      }
    }

    const { data, error } = await supabase
      .from("branches")
      .update({ is_active: false })
      .eq("id", branch.id)
      .select("id,name,code,address,phone,is_active,created_at")
      .single();

    if (error || !data) {
      throw new ApiError(500, "ALPI-BRCH-INT-123", error?.message || "Failed to deactivate branch.");
    }

    return NextResponse.json({ ok: true, item: data });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
