import { NextResponse, type NextRequest } from "next/server";

import { assertFeatureEnabled } from "@/lib/guards/subscription-feature";
import { toErrorResponse } from "@/lib/http/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantFromRequest } from "@/lib/tenant/tenant-context";

export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(request);

    await assertFeatureEnabled(tenant, "organization");

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("branches")
      .select("id,name,code,address,phone,is_active,created_at")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(100);

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
      count: data?.length ?? 0,
      items: data ?? [],
    });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
