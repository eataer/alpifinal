import type { NextRequest } from "next/server";

import { ApiError } from "@/lib/http/api-errors";

export function assertBootstrapAccess(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    throw new ApiError(403, "ALPI-SYS-PERM-050", "Bootstrap route is disabled in production.");
  }

  const expected = process.env.ALPI_BOOTSTRAP_KEY?.trim();

  if (!expected) {
    throw new ApiError(500, "ALPI-SYS-VAL-051", "Missing ALPI_BOOTSTRAP_KEY env var.");
  }

  const incoming = request.headers.get("x-bootstrap-key")?.trim();

  if (!incoming || incoming !== expected) {
    throw new ApiError(401, "ALPI-SYS-PERM-052", "Invalid bootstrap key.");
  }
}
