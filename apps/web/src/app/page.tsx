import { headers } from "next/headers";

export default async function Home() {
  const hdrs = await headers();
  const tenantSubdomain = hdrs.get("x-tenant-subdomain") || "";
  const isPlatformAdmin = hdrs.get("x-platform-admin") === "1";

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-3xl font-bold">Alpi 360 - Phase 1 Bootstrap</h1>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Runtime Context</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <span className="font-medium">Panel tipi:</span>{" "}
              {isPlatformAdmin ? "Platform Admin" : "Tenant App"}
            </li>
            <li>
              <span className="font-medium">Tenant subdomain:</span>{" "}
              {tenantSubdomain || "(yok)"}
            </li>
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Sıradaki Teknik Adımlar</h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
            <li>Supabase SQL migration çalıştır</li>
            <li>Tenant kaydı + seed scriptleri ekle</li>
            <li>Subscription/feature/permission/scope guard middleware</li>
            <li>RBAC seed roller + role assignment rules</li>
          </ol>

          <div className="mt-5">
            <a
              href="/tenant/rbac"
              className="inline-flex items-center rounded-md bg-indigo-700 px-3 py-2 text-sm font-medium text-white"
            >
              RBAC Console&apos;a Git
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
