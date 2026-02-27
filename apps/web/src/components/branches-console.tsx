"use client";

import { useMemo, useState } from "react";

type BranchItem = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
};

type BranchApiResponse = {
  ok: boolean;
  code?: string;
  message?: string;
  count?: number;
  items?: BranchItem[];
};

export default function BranchesConsole() {
  const [tenantSubdomain, setTenantSubdomain] = useState("demo");
  const [roleId, setRoleId] = useState("a581c118-66fb-439c-bbb3-1d8d5ed74c3b");

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  const [items, setItems] = useState<BranchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams({
      tenant_subdomain: tenantSubdomain,
      role_id: roleId,
    });
    return params.toString();
  }, [tenantSubdomain, roleId]);

  async function loadBranches() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/modules/organization/branches?${query}`, { cache: "no-store" });
      const data = (await res.json()) as BranchApiResponse;
      if (!data.ok) throw new Error(`${data.code || "ERROR"}: ${data.message || "Request failed"}`);
      setItems(data.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function createBranch() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/modules/organization/branches?${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, code, address, phone }),
      });

      const data = (await res.json()) as { ok: boolean; code?: string; message?: string };

      if (!data.ok) throw new Error(`${data.code || "ERROR"}: ${data.message || "Request failed"}`);

      setName("");
      setCode("");
      setAddress("");
      setPhone("");

      await loadBranches();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <h1 className="text-3xl font-bold">Branch Management (Phase 1)</h1>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              <div className="mb-1 font-medium">tenant_subdomain</div>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={tenantSubdomain}
                onChange={(e) => setTenantSubdomain(e.target.value)}
              />
            </label>

            <label className="text-sm">
              <div className="mb-1 font-medium">role_id (actor)</div>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
              onClick={loadBranches}
              disabled={loading}
            >
              Şubeleri Yükle
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">Yeni Şube Oluştur</h2>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              <div className="mb-1 font-medium">Şube adı</div>
              <input className="w-full rounded-md border border-slate-300 px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
            </label>

            <label className="text-sm">
              <div className="mb-1 font-medium">Şube kodu</div>
              <input className="w-full rounded-md border border-slate-300 px-3 py-2" value={code} onChange={(e) => setCode(e.target.value)} />
            </label>

            <label className="text-sm">
              <div className="mb-1 font-medium">Adres (opsiyonel)</div>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </label>

            <label className="text-sm">
              <div className="mb-1 font-medium">Telefon (opsiyonel)</div>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
          </div>

          <div className="mt-4">
            <button
              className="rounded-md bg-indigo-700 px-3 py-2 text-sm text-white"
              onClick={createBranch}
              disabled={loading || !name.trim() || !code.trim()}
            >
              Şube Oluştur
            </button>
          </div>

          {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">Şube Listesi</h2>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="py-2">Ad</th>
                  <th className="py-2">Kod</th>
                  <th className="py-2">Adres</th>
                  <th className="py-2">Telefon</th>
                  <th className="py-2">Durum</th>
                </tr>
              </thead>
              <tbody>
                {items.map((branch) => (
                  <tr key={branch.id} className="border-b border-slate-100">
                    <td className="py-2">{branch.name}</td>
                    <td className="py-2">{branch.code}</td>
                    <td className="py-2">{branch.address || "-"}</td>
                    <td className="py-2">{branch.phone || "-"}</td>
                    <td className="py-2">{branch.is_active ? "Aktif" : "Pasif"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
