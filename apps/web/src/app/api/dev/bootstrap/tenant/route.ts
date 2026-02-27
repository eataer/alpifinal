import { NextResponse, type NextRequest } from "next/server";

import { assertBootstrapAccess } from "@/lib/bootstrap/guard";
import { toErrorResponse, ApiError } from "@/lib/http/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";

type BootstrapBody = {
  tenantName: string;
  subdomain: string;
  packageName?: "Basic" | "Pro" | "Enterprise";
  ownerEmail: string;
  ownerPassword: string;
  ownerFullName?: string;
  branchName?: string;
  branchCode?: string;
};

function normalizeSubdomain(value: string) {
  return value.trim().toLowerCase();
}

function validateBody(body: Partial<BootstrapBody>): BootstrapBody {
  if (!body.tenantName?.trim()) throw new ApiError(400, "ALPI-TEN-VAL-001", "tenantName is required.");
  if (!body.subdomain?.trim()) throw new ApiError(400, "ALPI-TEN-VAL-002", "subdomain is required.");
  if (!body.ownerEmail?.trim()) throw new ApiError(400, "ALPI-TEN-VAL-003", "ownerEmail is required.");
  if (!body.ownerPassword?.trim() || body.ownerPassword.length < 6) {
    throw new ApiError(400, "ALPI-TEN-VAL-004", "ownerPassword is required and must be at least 6 chars.");
  }

  return {
    tenantName: body.tenantName.trim(),
    subdomain: normalizeSubdomain(body.subdomain),
    packageName: body.packageName || "Pro",
    ownerEmail: body.ownerEmail.trim().toLowerCase(),
    ownerPassword: body.ownerPassword,
    ownerFullName: body.ownerFullName?.trim() || "Firma Sahibi",
    branchName: body.branchName?.trim() || "Merkez Şube",
    branchCode: body.branchCode?.trim() || "MRK",
  };
}

export async function POST(request: NextRequest) {
  try {
    assertBootstrapAccess(request);

    const json = (await request.json()) as Partial<BootstrapBody>;
    const input = validateBody(json);

    const supabase = createAdminClient();

    const { data: existingTenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("subdomain", input.subdomain)
      .maybeSingle();

    if (existingTenant?.id) {
      throw new ApiError(409, "ALPI-TEN-CON-021", "Subdomain already exists.");
    }

    const { data: plan } = await supabase
      .from("plans")
      .select("id")
      .eq("name", input.packageName)
      .single();

    if (!plan?.id) {
      throw new ApiError(404, "ALPI-TEN-NOTF-011", `Plan not found: ${input.packageName}`);
    }

    const { data: authUserResp, error: authError } = await supabase.auth.admin.createUser({
      email: input.ownerEmail,
      password: input.ownerPassword,
      email_confirm: true,
      user_metadata: {
        full_name: input.ownerFullName,
      },
    });

    if (authError || !authUserResp.user?.id) {
      throw new ApiError(400, "ALPI-AUTH-VAL-005", authError?.message || "Failed to create auth user.");
    }

    const today = new Date();
    const end = new Date(today);
    end.setMonth(end.getMonth() + 6);

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .insert({
        name: input.tenantName,
        subdomain: input.subdomain,
        package_id: plan.id,
        status: "active",
        subscription_status: "active",
        subscription_start_date: today.toISOString().slice(0, 10),
        subscription_end_date: end.toISOString().slice(0, 10),
      })
      .select("id,name,subdomain")
      .single();

    if (tenantError || !tenant?.id) {
      throw new ApiError(500, "ALPI-TEN-INT-076", tenantError?.message || "Failed to create tenant.");
    }

    const { data: branch, error: branchError } = await supabase
      .from("branches")
      .insert({
        tenant_id: tenant.id,
        name: input.branchName,
        code: input.branchCode,
        is_active: true,
      })
      .select("id,name,code")
      .single();

    if (branchError || !branch?.id) {
      throw new ApiError(500, "ALPI-BRCH-INT-077", branchError?.message || "Failed to create branch.");
    }

    const { data: ownerRole, error: roleError } = await supabase
      .from("roles")
      .insert({
        tenant_id: tenant.id,
        name: "Firma Sahibi",
        is_system: true,
        is_protected: true,
        is_editable: true,
        is_active: true,
      })
      .select("id,name")
      .single();

    if (roleError || !ownerRole?.id) {
      throw new ApiError(500, "ALPI-PERM-INT-078", roleError?.message || "Failed to create owner role.");
    }

    const { data: allPermissions, error: permsError } = await supabase.from("permissions").select("id");

    if (permsError || !allPermissions) {
      throw new ApiError(500, "ALPI-PERM-INT-079", permsError?.message || "Failed to read permissions.");
    }

    if (allPermissions.length > 0) {
      const ownerPermRows = allPermissions.map((perm) => ({
        role_id: ownerRole.id,
        permission_id: perm.id,
        scope: "entire_company",
      }));

      const { error: ownerPermError } = await supabase.from("role_permissions").insert(ownerPermRows);

      if (ownerPermError) {
        throw new ApiError(500, "ALPI-PERM-INT-080", ownerPermError.message || "Failed to assign owner permissions.");
      }
    }

    const { data: tenantUser, error: tenantUserError } = await supabase
      .from("tenant_users")
      .insert({
        tenant_id: tenant.id,
        auth_user_id: authUserResp.user.id,
        role_id: ownerRole.id,
        email: input.ownerEmail,
        full_name: input.ownerFullName,
        status: "active",
      })
      .select("id")
      .single();

    if (tenantUserError || !tenantUser?.id) {
      throw new ApiError(500, "ALPI-PERM-INT-081", tenantUserError?.message || "Failed to create tenant user.");
    }

    const { error: userBranchError } = await supabase.from("user_branches").insert({
      tenant_id: tenant.id,
      user_id: tenantUser.id,
      branch_id: branch.id,
      is_primary: true,
      is_active: true,
    });

    if (userBranchError) {
      throw new ApiError(500, "ALPI-BRCH-INT-082", userBranchError.message || "Failed to assign primary branch.");
    }

    return NextResponse.json({
      ok: true,
      tenant,
      branch,
      ownerRole,
      owner: {
        email: input.ownerEmail,
        authUserId: authUserResp.user.id,
      },
    });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
