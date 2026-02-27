import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";
import { resolveTenantFromHost } from "@/lib/tenant/resolve-tenant";

export async function middleware(request: NextRequest) {
  const sessionResponse = await updateSession(request);

  const { isPlatformAdmin, tenantSubdomain } = resolveTenantFromHost(request.headers.get("host"));

  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("x-platform-admin", isPlatformAdmin ? "1" : "0");
  requestHeaders.set("x-tenant-subdomain", tenantSubdomain ?? "");

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  sessionResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value, cookie);
  });

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
