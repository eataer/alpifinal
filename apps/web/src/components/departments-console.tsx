"use client";

import { useMemo, useState } from "react";

type DepartmentItem = {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
  created_at: string;
};

type DepartmentApiResponse = {
  ok: boolean;
  code?: string;
  message?: string;
  count?: number;
  items?: DepartmentItem[];
};

export default function DepartmentsConsole() {
  const [tenantSubdomain, setTenantSubdomain] = useState("demo");
  const [roleId, setRoleId] = useState("a581c118-66fb-439c-bbb3-1d8d5ed74c3b");
  const [includeInactive, setIncludeInactive] = useState(true);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");

  const [items, setItems] = useState<DepartmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams({
      tenant_subdomain: tenantSubdomain,
      role_id: roleId,
      include_inactive: includeInactive ? "true" : "false",
    });
    return params.toString();
  }, [tenantSubdomain, roleId, includeInactive]);

  async function loadDepartments() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/modules/organization/departments?${query}`, { cache: "no-store" });
      const data = (await res.json()) as DepartmentApiResponse;
      if (!data.ok) throw new Error(`${data.code || "ERROR"}: ${data.message || "Request failed"}`);
      setItems(data.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function createDepartment() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/modules/organization/departments?tenant_subdomain=${tenantSubdomain}&role_id=${roleId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, code }),
      });

      const data = (await res.json()) as { ok: boolean; code?: string; message?: string };
      if (!data.ok) throw new Error(`${data.code || "ERROR"}: ${data.message || "Request failed"}`);

      setName("");
      setCode("");
      await loadDepartments();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function saveEdit() {
    if (!editId) return;

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/modules/organization/departments/${editId}?tenant_subdomain=${tenantSubdomain}&role_id=${roleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, code: editCode }),
      });

      const data = (await res.json()) as { ok: boolean; code?: string; message?: string };
      if (!data.ok) throw new Error(`${data.code || "ERROR"}: ${data.message || "Request failed"}`);

      setEditId("");
      setEditName("");
      setEditCode("");
      await loadDepartments();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function deactivateDepartment(departmentId: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/modules/organization/departments/${departmentId}/deactivate?tenant_subdomain=${tenantSubdomain}&role_id=${roleId}`,
        { method: "POST" },
      );
      const data = (await res.json()) as { ok: boolean; code?: string; message?: string };
      if (!data.ok) throw new Error(`${data.code || "ERROR"}: ${data.message || "Request failed"}`);
      await loadDepartments();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <h1 className="text-3xl font-bold">Department Management (Phase 1)</h1>

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

          <label className="mt-3 inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
            />
            Pasif departmanları da göster
          </label>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
              onClick={loadDepartments}
              disabled={loading}
            >
              Departmanları Yükle
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">Yeni Departman Oluştur</h2>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              <div className="mb-1 font-medium">Departman adı</div>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <label className="text-sm">
              <div className="mb-1 font-medium">Departman kodu (opsiyonel)</div>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
          </div>

          <div className="mt-4">
            <button
              className="rounded-md bg-indigo-700 px-3 py-2 text-sm text-white"
              onClick={createDepartment}
              disabled={loading || !name.trim()}
            >
              Departman Oluştur
            </button>
          </div>

          {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">Departman Listesi</h2>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="py-2">Ad</th>
                  <th className="py-2">Kod</th>
                  <th className="py-2">Durum</th>
                  <th className="py-2">Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {items.map((department) => (
                  <tr key={department.id} className="border-b border-slate-100">
                    <td className="py-2">{department.name}</td>
                    <td className="py-2">{department.code || "-"}</td>
                    <td className="py-2">{department.is_active ? "Aktif" : "Pasif"}</td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        <button
                          className="rounded border border-slate-300 px-2 py-1"
                          onClick={() => {
                            setEditId(department.id);
                            setEditName(department.name);
                            setEditCode(department.code || "");
                          }}
                        >
                          Düzenle
                        </button>
                        <button
                          className="rounded border border-rose-300 px-2 py-1 text-rose-700"
                          onClick={() => deactivateDepartment(department.id)}
                          disabled={!department.is_active}
                        >
                          Pasife Al
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {editId ? (
          <section className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
            <h2 className="mb-3 text-lg font-semibold">Departman Düzenle</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                <div className="mb-1 font-medium">Departman adı</div>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Departman kodu (opsiyonel)</div>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                />
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                className="rounded-md bg-indigo-700 px-3 py-2 text-sm text-white"
                onClick={saveEdit}
                disabled={loading || !editName.trim()}
              >
                Kaydet
              </button>
              <button
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                onClick={() => {
                  setEditId("");
                  setEditName("");
                  setEditCode("");
                }}
              >
                İptal
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
