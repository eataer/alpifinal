import { ApiError } from "@/lib/http/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TenantRecord } from "@/lib/tenant/tenant-context";

function assertSubscriptionAccess(tenant: TenantRecord) {
  const allowedStatuses: TenantRecord["subscription_status"][] = ["active", "trial"];

  if (!allowedStatuses.includes(tenant.subscription_status)) {
    throw new ApiError(
      403,
      "ALPI-TEN-STAT-031",
      `Tenant subscription is not active (current: ${tenant.subscription_status}).`,
    );
  }

  if (tenant.status === "suspended" || tenant.status === "cancelled") {
    throw new ApiError(403, "ALPI-TEN-STAT-032", `Tenant status does not allow access (current: ${tenant.status}).`);
  }
}

export async function assertFeatureEnabled(tenant: TenantRecord, featureKey: string) {
  assertSubscriptionAccess(tenant);

  const supabase = createAdminClient();

  const { data: feature, error: featureError } = await supabase
    .from("features")
    .select("id,is_active")
    .eq("key", featureKey)
    .single();

  if (featureError || !feature?.id || !feature.is_active) {
    throw new ApiError(404, "ALPI-FEAT-NOTF-012", `Feature not found or inactive: ${featureKey}`);
  }

  let enabledFromPlan = false;

  if (tenant.package_id) {
    const { data: planFeature } = await supabase
      .from("plan_features")
      .select("is_enabled")
      .eq("plan_id", tenant.package_id)
      .eq("feature_id", feature.id)
      .maybeSingle();

    enabledFromPlan = Boolean(planFeature?.is_enabled);
  }

  const { data: tenantOverride } = await supabase
    .from("tenant_features")
    .select("mode")
    .eq("tenant_id", tenant.id)
    .eq("feature_id", feature.id)
    .maybeSingle();

  const mode = tenantOverride?.mode ?? "inherit";

  const isEnabled = mode === "enable" ? true : mode === "disable" ? false : enabledFromPlan;

  if (!isEnabled) {
    throw new ApiError(403, "ALPI-FEAT-LIM-061", `Feature disabled for tenant: ${featureKey}`);
  }
}
