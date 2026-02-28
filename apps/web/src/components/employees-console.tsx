"use client";

import { useMemo, useState } from "react";

type EmployeeItem = {
  id: string;
  employee_no: string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  department_id: string | null;
  primary_branch_id: string | null;
  status: "active" | "suspended" | "terminated";
  hire_date: string | null;
  created_at: string;
};

type LookupItem = { id: string; name: string; code?: string | null; is_active?: boolean };

export default function EmployeesConsole() {
  const [tenantSubdomain, setTenantSubdomain] = useState("demo");
  const [roleId, setRoleId] = useState("a581c118-66fb-439c-bbb3-1d8d5ed74c3b");
  const [branchFilter, setBranchFilter] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);

  const [employeeNo, setEmployeeNo] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [primaryBranchId, setPrimaryBranchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [hireDate, setHireDate] = useState("");

  const [items, setItems] = useState<EmployeeItem[]>([]);
  const [branches, setBranches] = useState<LookupItem[]>([]);
  const [departments, setDepartments] = useState<LookupItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const baseQuery = useMemo(() => {
    const p = new URLSearchParams({
      tenant_subdomain: tenantSubdomain,
      role_id: roleId,
    });
    return p.toString();
  }, [tenantSubdomain, roleId]);

  const employeeQuery = useMemo(() => {
    const p = new URLSearchParams({
      tenant_subdomain: tenantSubdomain,
      role_id: roleId,
      include_inactive: includeInactive ? "true" : "false",
    });
    if (branchFilter) p.set("branch_id", branchFilter);
    return p.toString();
  }, [tenantSubdomain, roleId, includeInactive, branchFilter]);

  async function loadLookups() {
    const [branchRes, deptRes] = await Promise.all([
      fetch(`/api/modules/organization/branches?${baseQuery}`, { cache: "no-store" }),
      fetch(`/api/modules/organization/departments?${baseQuery}&include_inactive=true`, { cache: "no-store" }),
    ]);

    const branchData = (await branchRes.json()) as { ok: boolean; items?: LookupItem[]; code?: string; message?: string };
    const deptData = (await deptRes.json()) as { ok: boolean; items?: LookupItem[]; code?: string; message?: string };

    if (!branchData.ok) throw new Error(`${branchData.code || "ERROR"}: ${branchData.message || "Failed to load branches"}`);
    if (!deptData.ok) throw new Error(`${deptData.code || "ERROR"}: ${deptData.message || "Failed to load departments"}`);

    setBranches(branchData.items || []);
    setDepartments(deptData.items || []);
  }

  async function loadEmployees() {
    setLoading(true);
    setError("");
    try {
      await loadLookups();

      const res = await fetch(`/api/modules/hr/employees?${employeeQuery}`, { cache: "no-store" });
      const data = (await res.json()) as { ok: boolean; items?: EmployeeItem[]; code?: string; message?: string };
      if (!data.ok) throw new Error(`${data.code || "ERROR"}: ${data.message || "Request failed"}`);
      setItems(data.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function createEmployee() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/modules/hr/employees?${baseQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeNo: employeeNo || null,
          firstName,
          lastName,
          phone: phone || null,
          email: email || null,
          primaryBranchId: primaryBranchId || null,
          departmentId: departmentId || null,
          hireDate: hireDate || null,
        }),
      });
      const data = (await res.json()) as { ok: boolean; code?: string; message?: string };
      if (!data.ok) throw new Error(`${data.code || "ERROR"}: ${data.message || "Request failed"}`);

      setEmployeeNo("");
      setFirstName("");
      setLastName("");
      setPhone("");
      setEmail("");
      setPrimaryBranchId("");
      setDepartmentId("");
      setHireDate("");
      await loadEmployees();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function suspendEmployee(id: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/modules/hr/employees/${id}/suspend?${baseQuery}`, { method: "POST" });
      const data = (await res.json()) as { ok: boolean; code?: string; message?: string };
      if (!data.ok) throw new Error(`${data.code || "ERROR"}: ${data.message || "Request failed"}`);
      await loadEmployees();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function terminateEmployee(id: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/modules/hr/employees/${id}/terminate?${baseQuery}`, { method: "POST" });
      const data = (await res.json()) as { ok: boolean; code?: string; message?: string };
      if (!data.ok) throw new Error(`${data.code || "ERROR"}: ${data.message || "Request failed"}`);
      await loadEmployees();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <h1 className="text-3xl font-bold">Employees Console (Phase 2)</h1>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm">
              <div className="mb-1 font-medium">tenant_subdomain</div>
              <input className="w-full rounded-md border border-slate-300 px-3 py-2" value={tenantSubdomain} onChange={(e) => setTenantSubdomain(e.target.value)} />
            </label>
            <label className="text-sm md:col-span-2">
              <div className="mb-1 font-medium">role_id (actor)</div>
              <input className="w-full rounded-md border border-slate-300 px-3 py-2" value={roleId} onChange={(e) => setRoleId(e.target.value)} />
            </label>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="text-sm">
              <div className="mb-1 font-medium">Şube filtresi</div>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
              >
                <option value="">Tümü</option>
                {branches.filter((b) => b.is_active !== false).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.code ? `(${b.code})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="inline-flex items-center gap-2 text-sm md:pt-7">
              <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
              Terminated çalışanları da göster
            </label>
          </div>

          <div className="mt-4">
            <button className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white" onClick={loadEmployees} disabled={loading}>
              Çalışanları Yükle
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">Yeni Çalışan Ekle</h2>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="text-sm">
              <div className="mb-1 font-medium">Çalışan No (ops.)</div>
              <input className="w-full rounded-md border border-slate-300 px-3 py-2" value={employeeNo} onChange={(e) => setEmployeeNo(e.target.value)} />
            </label>
            <label className="text-sm">
              <div className="mb-1 font-medium">Ad *</div>
              <input className="w-full rounded-md border border-slate-300 px-3 py-2" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </label>
            <label className="text-sm">
              <div className="mb-1 font-medium">Soyad *</div>
              <input className="w-full rounded-md border border-slate-300 px-3 py-2" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </label>
            <label className="text-sm">
              <div className="mb-1 font-medium">Telefon</div>
              <input className="w-full rounded-md border border-slate-300 px-3 py-2" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label className="text-sm">
              <div className="mb-1 font-medium">E-posta</div>
              <input className="w-full rounded-md border border-slate-300 px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="text-sm">
              <div className="mb-1 font-medium">Primary Şube</div>
              <select className="w-full rounded-md border border-slate-300 px-3 py-2" value={primaryBranchId} onChange={(e) => setPrimaryBranchId(e.target.value)}>
                <option value="">Seçiniz</option>
                {branches.filter((b) => b.is_active !== false).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.code ? `(${b.code})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <div className="mb-1 font-medium">Departman</div>
              <select className="w-full rounded-md border border-slate-300 px-3 py-2" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                <option value="">Seçiniz</option>
                {departments.filter((d) => d.is_active !== false).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <div className="mb-1 font-medium">İşe giriş tarihi</div>
              <input type="date" className="w-full rounded-md border border-slate-300 px-3 py-2" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
            </label>
          </div>

          <div className="mt-4">
            <button
              className="rounded-md bg-indigo-700 px-3 py-2 text-sm text-white"
              onClick={createEmployee}
              disabled={loading || !firstName.trim() || !lastName.trim()}
            >
              Çalışan Oluştur
            </button>
          </div>

          {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">Çalışan Listesi</h2>
          <div className="max-h-[32rem] overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="py-2">Ad Soyad</th>
                  <th className="py-2">No</th>
                  <th className="py-2">Telefon</th>
                  <th className="py-2">E-posta</th>
                  <th className="py-2">Durum</th>
                  <th className="py-2">Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {items.map((emp) => (
                  <tr key={emp.id} className="border-b border-slate-100">
                    <td className="py-2">{emp.full_name}</td>
                    <td className="py-2">{emp.employee_no || "-"}</td>
                    <td className="py-2">{emp.phone || "-"}</td>
                    <td className="py-2">{emp.email || "-"}</td>
                    <td className="py-2">{emp.status}</td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        <button
                          className="rounded border border-amber-300 px-2 py-1 text-amber-700 disabled:opacity-40"
                          disabled={emp.status !== "active"}
                          onClick={() => suspendEmployee(emp.id)}
                        >
                          Askıya Al
                        </button>
                        <button
                          className="rounded border border-rose-300 px-2 py-1 text-rose-700 disabled:opacity-40"
                          disabled={emp.status === "terminated"}
                          onClick={() => terminateEmployee(emp.id)}
                        >
                          İşten Çıkar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
