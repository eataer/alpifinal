import { NextResponse, type NextRequest } from "next/server";

import { getRequestActor } from "@/lib/auth/request-actor";
import { assertPermissionAndScope } from "@/lib/guards/permission-scope";
import { assertFeatureEnabled } from "@/lib/guards/subscription-feature";
import { ApiError, toErrorResponse } from "@/lib/http/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantFromRequest } from "@/lib/tenant/tenant-context";

export const dynamic = "force-dynamic";

type CreateEmployeePayload = {
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

function normalizePayload(payload: Partial<CreateEmployeePayload>) {
  const firstName = payload.firstName?.trim();
  const lastName = payload.lastName?.trim();

  if (!firstName) throw new ApiError(400, "ALPI-EMP-VAL-201", "firstName is required.");
  if (!lastName) throw new ApiError(400, "ALPI-EMP-VAL-202", "lastName is required.");

  return {
    employee_no: payload.employeeNo?.trim() || null,
    first_name: firstName,
    last_name: lastName,
    phone: payload.phone?.trim() || null,
    email: payload.email?.trim() || null,
    department_id: payload.departmentId?.trim() || null,
    primary_branch_id: payload.primaryBranchId?.trim() || null,
    hire_date: payload.hireDate?.trim() || null,
    notes: payload.notes?.trim() || null,
  };
}

function assertBranchScope(branchId: string | null, actorAssignedBranchIds: string[]) {
  if (!branchId) {
    throw new ApiError(400, "ALPI-EMP-VAL-203", "primaryBranchId is required for branch-scoped operation.");
  }
  if (actorAssignedBranchIds.length > 0 && !actorAssignedBranchIds.includes(branchId)) {
    throw new ApiError(403, "ALPI-EMP-PERM-204", "Cannot access employee branch outside actor scope.");
  }
}

export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(request);
    const actor = await getRequestActor(request, tenant.id);

    await assertFeatureEnabled(tenant, "hr");
    const permission = await assertPermissionAndScope({
      tenantId: tenant.id,
      roleId: actor.roleId,
      permissionKey: "employees.view",
      requestedBranchId: request.nextUrl.searchParams.get("branch_id"),
      actorPrimaryBranchId: actor.primaryBranchId,
      actorAssignedBranchIds: actor.assignedBranchIds,
    });

    const includeInactive = request.nextUrl.searchParams.get("include_inactive") === "true";
    const requestedBranchId = request.nextUrl.searchParams.get("branch_id");
    const supabase = createAdminClient();

    let query = supabase
      .from("employees")
      .select("id,employee_no,first_name,last_name,full_name,phone,email,department_id,primary_branch_id,status,hire_date,terminated_at,notes,created_at")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false });

    if (!includeInactive) {
      query = query.neq("status", "terminated");
    }

    if (permission.scope === "assigned_branch") {
      const scopedBranches =
        requestedBranchId && actor.assignedBranchIds.includes(requestedBranchId)
          ? [requestedBranchId]
          : actor.assignedBranchIds.length > 0
            ? actor.assignedBranchIds
            : permission.branchId
              ? [permission.branchId]
              : [];

      if (scopedBranches.length === 0) {
        return NextResponse.json({ ok: true, count: 0, items: [] });
      }
      query = query.in("primary_branch_id", scopedBranches);
    } else if (requestedBranchId) {
      query = query.eq("primary_branch_id", requestedBranchId);
    }

    const { data, error } = await query;
    if (error) throw new ApiError(500, "ALPI-EMP-INT-205", error.message || "Failed to list employees.");

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

    await assertFeatureEnabled(tenant, "hr");
    const permission = await assertPermissionAndScope({
      tenantId: tenant.id,
      roleId: actor.roleId,
      permissionKey: "employees.create",
      requestedBranchId: null,
      actorPrimaryBranchId: actor.primaryBranchId,
      actorAssignedBranchIds: actor.assignedBranchIds,
    });

    const payload = normalizePayload((await request.json()) as Partial<CreateEmployeePayload>);
    if (permission.scope === "assigned_branch") {
      assertBranchScope(payload.primary_branch_id, actor.assignedBranchIds);
    }

    const supabase = createAdminClient();
    const { data: employee, error: insertError } = await supabase
      .from("employees")
      .insert({
        tenant_id: tenant.id,
        ...payload,
      })
      .select(
        "id,employee_no,first_name,last_name,full_name,phone,email,department_id,primary_branch_id,status,hire_date,terminated_at,notes,created_at",
      )
      .single();

    if (insertError || !employee) {
      const status = insertError?.code === "23505" ? 409 : 500;
      const code = insertError?.code === "23505" ? "ALPI-EMP-VAL-206" : "ALPI-EMP-INT-207";
      const message =
        insertError?.code === "23505"
          ? "Employee with same employeeNo already exists."
          : insertError?.message || "Failed to create employee.";
      throw new ApiError(status, code, message);
    }

    if (employee.primary_branch_id) {
      const { error: branchLinkError } = await supabase.from("employee_branches").upsert(
        {
          tenant_id: tenant.id,
          employee_id: employee.id,
          branch_id: employee.primary_branch_id,
          is_primary: true,
          is_active: true,
        },
        { onConflict: "tenant_id,employee_id,branch_id" },
      );

      if (branchLinkError) {
        throw new ApiError(500, "ALPI-EMP-INT-208", branchLinkError.message || "Failed to link employee branch.");
      }
    }

    return NextResponse.json({ ok: true, item: employee }, { status: 201 });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
