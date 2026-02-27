"use client";

import { useMemo, useState } from "react";

type RoleItem = {
  id: string;
  name: string;
  is_active: boolean;
};

type PermissionItem = {
  id: string;
  key: string;
  resource: string;
  action: string;
};

type RolePermissionItem = {
  scope: string;
  permission: PermissionItem;
};

type ApiResponse<T> = {
  ok: boolean;
  code?: string;
  message?: string;
  items?: T[];
  count?: number;
};

export default function RbacConsole() {
  const [tenantSubdomain, setTenantSubdomain] = useState("demo");
  const [roleId, setRoleId] = useState("a581c118-66fb-439c-bbb3-1d8d5ed74c3b");

  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermissionItem[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const query = useMemo(() => {
    const params = new URLSearchParams({
      tenant_subdomain: tenantSubdomain,
      role_id: roleId,
    });
    return params.toString();
  }, [tenantSubdomain, roleId]);

  async function request<T>(url: string): Promise<ApiResponse<T>> {
    const res = await fetch(url, { cache: "no-store" });
    return res.json();
  }

  async function loadRoles() {
    setLoading(true);
    setError("");
    try {
      const data = await request<RoleItem>(`/api/modules/users-roles/roles?${query}`);
      if (!data.ok) throw new Error(`${data.code || "ERROR"}: ${data.message || "Request failed"}`);
      setRoles(data.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function loadPermissions() {
    setLoading(true);
    setError("");
    try {
      const data = await request<PermissionItem>(`/api/modules/users-roles/permissions?${query}`);
      if (!data.ok) throw new Error(`${data.code || "ERROR"}: ${data.message || "Request failed"}`);
      setPermissions(data.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function loadRolePermissions() {
    if (!selectedRoleId) {
      setError("Önce rol seç.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await request<RolePermissionItem>(
        `/api/modules/users-roles/roles/${selectedRoleId}/permissions?${query}`,
      );
      if (!data.ok) throw new Error(`${data.code || "ERROR"}: ${data.message || "Request failed"}`);
      setRolePermissions(data.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <h1 className="text-3xl font-bold">RBAC Console (Phase 1)</h1>

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
              onClick={loadRoles}
              disabled={loading}
            >
              Rolleri Yükle
            </button>
            <button
              className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
              onClick={loadPermissions}
              disabled={loading}
            >
              Permissionları Yükle
            </button>
            <button
              className="rounded-md bg-indigo-700 px-3 py-2 text-sm text-white"
              onClick={loadRolePermissions}
              disabled={loading}
            >
              Seçili Rol Permissionları
            </button>
          </div>

          {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold">Roles</h2>
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="py-2">Ad</th>
                    <th className="py-2">Durum</th>
                    <th className="py-2">Seç</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="py-2">{r.name}</td>
                      <td className="py-2">{r.is_active ? "Aktif" : "Pasif"}</td>
                      <td className="py-2">
                        <button
                          className="rounded border border-slate-300 px-2 py-1"
                          onClick={() => setSelectedRoleId(r.id)}
                        >
                          {selectedRoleId === r.id ? "Seçili" : "Seç"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold">Permissions</h2>
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="py-2">Key</th>
                    <th className="py-2">Resource</th>
                    <th className="py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {permissions.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="py-2">{p.key}</td>
                      <td className="py-2">{p.resource}</td>
                      <td className="py-2">{p.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">Selected Role Permissions</h2>
          <p className="mb-2 text-sm text-slate-600">Seçili rol: {selectedRoleId || "(yok)"}</p>
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="py-2">Key</th>
                  <th className="py-2">Scope</th>
                  <th className="py-2">Resource</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {rolePermissions.map((rp, idx) => (
                  <tr key={`${rp.permission.id}-${idx}`} className="border-b border-slate-100">
                    <td className="py-2">{rp.permission.key}</td>
                    <td className="py-2">{rp.scope}</td>
                    <td className="py-2">{rp.permission.resource}</td>
                    <td className="py-2">{rp.permission.action}</td>
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
