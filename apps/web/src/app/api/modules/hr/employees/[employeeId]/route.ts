import { NextResponse, type NextRequest } from "next/server";

import { getRequestActor } from "@/lib/auth/request-actor";
import { assertPermissionAndScope } from "@/lib/guards/permission-scope";
import { assertFeatureEnabled } from "@/lib/guards/subscription-feature";
import { ApiError, toErrorResponse } from "@/lib/http/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantFromRequest } from "@/lib/tenant/tenant-context";

type UpdateEmployeePayload = {
  employeeNo?: string | null;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  email?: string | null;
  departmentId?: string | null;
  primaryBranchId?: string | null;
  hireDate?: string | null;
  notes?: string | null;
};

function normalizeUpdate(payload: Partial<UpdateEmployeePayload>) {
  const out: Record<string, string | null> = {};

  if (payload.employeeNo !== undefined) out.employee_no = payload.employeeNo?.trim() || null;
  if (payload.firstName !== undefined) {
    const val = payload.firstName.trim();
    if (!val) throw new ApiError(400, "ALPI-EMP-VAL-209", "firstName cannot be empty.");
    out.first_name = val;
  }
  if (payload.lastName !== undefined) {
    const val = payload.lastName.trim();
    if (!val) throw new ApiError(400, "ALPI-EMP-VAL-210", "lastName cannot be empty.");
    out.last_name = val;
  }
  if (payload.phone !== undefined) out.phone = payload.phone?.trim() || null;
  if (payload.email !== undefined) out.email = payload.email?.trim() || null;
  if (payload.departmentId !== undefined) out.department_id = payload.departmentId?.trim() || null;
  if (payload.primaryBranchId !== undefined) out.primary_branch_id = payload.primaryBranchId?.trim() || null;
  if (payload.hireDate !== undefined) out.hire_date = payload.hireDate?.trim() || null;
  if (payload.notes !== undefined) out.notes = payload.notes?.trim() || null;

  if (Object.keys(out).length === 0) {
    throw new ApiError(400, "ALPI-EMP-VAL-211", "At least one field is required for update.");
  }

  return out;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ employeeId: string }> }) {
  try {
    const tenant = await getTenantFromRequest(request);
    const actor = await getRequestActor(request, tenant.id);

    await assertFeatureEnabled(tenant, "hr");
    await assertPermissionAndScope({
      tenantId: tenant.id,
      roleId: actor.roleId,
      permissionKey: "employees.update",
      actorPrimaryBranchId: actor.primaryBranchId,
      actorAssignedBranchIds: actor.assignedBranchIds,
    });

    const { employeeId } = await params;
    const supabase = createAdminClient();

    const { data: existing, error: readError } = await supabase
      .from("employees")
      .select("id,tenant_id,primary_branch_id,status")
      .eq("id", employeeId)
      .single();

    if (readError || !existing?.id) {
      throw new ApiError(404, "ALPI-EMP-NOTF-212", "Employee not found.");
    }
    if (existing.tenant_id !== tenant.id) {
      throw new ApiError(403, "ALPI-EMP-PERM-213", "Cannot update employee from another tenant.");
    }

    const updates = normalizeUpdate((await request.json()) as Partial<UpdateEmployeePayload>);
    const nextBranchId = updates.primary_branch_id ?? existing.primary_branch_id;

    const permission = await assertPermissionAndScope({
      tenantId: tenant.id,
      roleId: actor.roleId,
      permissionKey: "employees.update",
      requestedBranchId: nextBranchId,
      actorPrimaryBranchId: actor.primaryBranchId,
      actorAssignedBranchIds: actor.assignedBranchIds,
    });

    if (permission.scope === "assigned_branch" && nextBranchId && actor.assignedBranchIds.length > 0 && !actor.assignedBranchIds.includes(nextBranchId)) {
      throw new ApiError(403, "ALPI-EMP-PERM-214", "Cannot assign employee to branch outside actor scope.");
    }

    const { data: updated, error: updateError } = await supabase
      .from("employees")
      .update(updates)
      .eq("id", existing.id)
      .select(
        "id,employee_no,first_name,last_name,full_name,phone,email,department_id,primary_branch_id,status,hire_date,terminated_at,notes,created_at",
      )
      .single();

    if (updateError || !updated) {
      const status = updateError?.code === "23505" ? 409 : 500;
      const code = updateError?.code === "23505" ? "ALPI-EMP-VAL-215" : "ALPI-EMP-INT-216";
      const message =
        updateError?.code === "23505"
          ? "Employee with same employeeNo already exists."
          : updateError?.message || "Failed to update employee.";
      throw new ApiError(status, code, message);
    }

    if (updated.primary_branch_id) {
      await supabase
        .from("employee_branches")
        .update({ is_primary: false })
        .eq("tenant_id", tenant.id)
        .eq("employee_id", updated.id)
        .eq("is_primary", true);

      const { error: branchLinkError } = await supabase.from("employee_branches").upsert(
        {
          tenant_id: tenant.id,
          employee_id: updated.id,
          branch_id: updated.primary_branch_id,
          is_primary: true,
          is_active: true,
        },
        { onConflict: "tenant_id,employee_id,branch_id" },
      );

      if (branchLinkError) {
        throw new ApiError(500, "ALPI-EMP-INT-217", branchLinkError.message || "Failed to sync employee branch link.");
      }
    }

    return NextResponse.json({ ok: true, item: updated });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
