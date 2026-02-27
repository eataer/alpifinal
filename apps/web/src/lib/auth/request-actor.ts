import type { NextRequest } from "next/server";

import { ApiError } from "@/lib/http/api-errors";

export type RequestActor = {
  roleId: string;
  branchId: string | null;
};

function readWithFallback(request: NextRequest, headerKey: string, queryKey: string) {
  return request.headers.get(headerKey)?.trim() || request.nextUrl.searchParams.get(queryKey)?.trim() || "";
}

export function getRequestActor(request: NextRequest): RequestActor {
  const roleId = readWithFallback(request, "x-role-id", "role_id");
  const branchIdRaw = readWithFallback(request, "x-branch-id", "branch_id");

  if (!roleId) {
    throw new ApiError(
      401,
      "ALPI-PERM-VAL-041",
      "Missing actor role context. Provide x-role-id header or role_id query param.",
    );
  }

  return {
    roleId,
    branchId: branchIdRaw || null,
  };
}
