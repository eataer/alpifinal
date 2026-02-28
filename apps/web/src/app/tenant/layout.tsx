import type { ReactNode } from "react";
import Link from "next/link";

import TenantShellNav from "@/components/tenant-shell-nav";

export default function TenantLayout({ children }: { children: ReactNode }) {
  return (
    <div className="alpi-page-bg min-h-screen">
      <div className="mx-auto grid min-h-screen max-w-[1440px] grid-cols-1 lg:grid-cols-[260px_1fr]">
        <TenantShellNav />

        <div className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Alpi 360 Workspace
                </div>
                <div className="text-lg font-semibold text-slate-900">Operasyon Paneli</div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Bootstrap Home
                </Link>
              </div>
            </div>
          </header>

          <main className="px-6 py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
