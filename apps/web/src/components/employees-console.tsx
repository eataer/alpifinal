"use client";

import { useEffect, useMemo, useState } from "react";

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

function statusBadge(status: EmployeeItem["status"]) {
  if (status === "active") return "bg-emerald-100 text-emerald-800";
  if (status === "suspended") return "bg-amber-100 text-amber-800";
  return "bg-rose-100 text-rose-800";
}

export default function EmployeesConsole() {
  const [tenantSubdomain, setTenantSubdomain] = useState("demo");
  const [roleId, setRoleId] = useState("a581c118-66fb-439c-bbb3-1d8d5ed74c3b");
  const [includeInactive, setIncludeInactive] = useState(true);
  const [branchFilter, setBranchFilter] = useState("");
  const [search, setSearch] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
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

  const branchMap = useMemo(() => new Map(branches.map((b) => [b.id, b])), [branches]);
  const departmentMap = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments]);

  const filteredItems = useMemo(() => {
    return items.filter((emp) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        emp.full_name.toLowerCase().includes(q) ||
        (emp.employee_no || "").toLowerCase().includes(q) ||
        (emp.phone || "").toLowerCase().includes(q) ||
        (emp.email || "").toLowerCase().includes(q)
      );
    });
  }, [items, search]);

  const activeCount = items.filter((i) => i.status === "active").length;
  const suspendedCount = items.filter((i) => i.status === "suspended").length;
  const terminatedCount = items.filter((i) => i.status === "terminated").length;

  useEffect(() => {
    // base query degistiginde ilk veriyi yukle
    void loadEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeQuery]);

  async function loadLookups() {
    const [branchRes, deptRes] = await Promise.all([
      fetch(`/api/modules/organization/branches?${baseQuery}`, { cache: "no-store" }),
      fetch(`/api/modules/organization/departments?${baseQuery}&include_inactive=true`, { cache: "no-store" }),
    ]);

    const branchData = (await branchRes.json()) as {
      ok: boolean;
      items?: LookupItem[];
      code?: string;
      message?: string;
    };
    const deptData = (await deptRes.json()) as {
      ok: boolean;
      items?: LookupItem[];
      code?: string;
      message?: string;
    };

    if (!branchData.ok) {
      throw new Error(`${branchData.code || "ERROR"}: ${branchData.message || "Failed to load branches"}`);
    }
    if (!deptData.ok) {
      throw new Error(`${deptData.code || "ERROR"}: ${deptData.message || "Failed to load departments"}`);
    }

    setBranches(branchData.items || []);
    setDepartments(deptData.items || []);
  }

  async function loadEmployees() {
    setLoading(true);
    setError("");
    try {
      await loadLookups();

      const res = await fetch(`/api/modules/hr/employees?${employeeQuery}`, { cache: "no-store" });
      const data = (await res.json()) as {
        ok: boolean;
        items?: EmployeeItem[];
        code?: string;
        message?: string;
      };
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
      setCreateOpen(false);
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
    <div className="space-y-5 text-slate-900">
      <section className="alpi-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Personel Yonetimi</h1>
            <p className="mt-1 text-sm text-slate-600">
              Personel kayitlari, durum yonetimi ve sube atamasi tek ekranda.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              onClick={loadEmployees}
              disabled={loading}
            >
              Yenile
            </button>
            <button
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              onClick={() => setCreateOpen(true)}
            >
              Yeni Personel
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="alpi-card p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Aktif</div>
          <div className="mt-2 text-2xl font-semibold text-emerald-700">{activeCount}</div>
        </article>
        <article className="alpi-card p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Askida</div>
          <div className="mt-2 text-2xl font-semibold text-amber-700">{suspendedCount}</div>
        </article>
        <article className="alpi-card p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Terminated</div>
          <div className="mt-2 text-2xl font-semibold text-rose-700">{terminatedCount}</div>
        </article>
      </section>

      <section className="alpi-card p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm">
            <div className="mb-1 font-medium text-slate-700">Tenant</div>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={tenantSubdomain}
              onChange={(e) => setTenantSubdomain(e.target.value)}
            />
          </label>
          <label className="text-sm xl:col-span-2">
            <div className="mb-1 font-medium text-slate-700">Role Id (debug actor)</div>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 font-medium text-slate-700">Sube filtresi</div>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
            >
              <option value="">Tum subeler</option>
              {branches.filter((b) => b.is_active !== false).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.code ? `(${b.code})` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm md:max-w-xl"
            placeholder="Ad soyad, personel no, telefon veya e-posta ile ara"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
            Terminated kayitlari dahil et
          </label>
        </div>

        {error ? (
          <div className="mt-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
      </section>

      <section className="alpi-card overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-lg font-semibold">Personel Listesi</h2>
        </div>
        <div className="max-h-[560px] overflow-auto px-2 py-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-600">
                <th className="px-2 py-2">Ad Soyad</th>
                <th className="px-2 py-2">No</th>
                <th className="px-2 py-2">Sube</th>
                <th className="px-2 py-2">Departman</th>
                <th className="px-2 py-2">Iletisim</th>
                <th className="px-2 py-2">Durum</th>
                <th className="px-2 py-2">Aksiyon</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((emp) => {
                const b = emp.primary_branch_id ? branchMap.get(emp.primary_branch_id) : null;
                const d = emp.department_id ? departmentMap.get(emp.department_id) : null;

                return (
                  <tr key={emp.id} className="border-b border-slate-100">
                    <td className="px-2 py-2 font-medium text-slate-900">{emp.full_name}</td>
                    <td className="px-2 py-2 font-mono text-xs text-slate-700">{emp.employee_no || "-"}</td>
                    <td className="px-2 py-2 text-slate-700">{b ? `${b.name}${b.code ? ` (${b.code})` : ""}` : "-"}</td>
                    <td className="px-2 py-2 text-slate-700">{d?.name || "-"}</td>
                    <td className="px-2 py-2 text-slate-700">
                      <div>{emp.phone || "-"}</div>
                      <div className="text-xs text-slate-500">{emp.email || "-"}</div>
                    </td>
                    <td className="px-2 py-2">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge(emp.status)}`}>
                        {emp.status}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-lg border border-amber-300 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-40"
                          disabled={emp.status !== "active"}
                          onClick={() => suspendEmployee(emp.id)}
                        >
                          Askiya Al
                        </button>
                        <button
                          className="rounded-lg border border-rose-300 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                          disabled={emp.status === "terminated"}
                          onClick={() => terminateEmployee(emp.id)}
                        >
                          Terminate
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredItems.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-slate-500">Filtreye uygun personel bulunamadi.</div>
          ) : null}
        </div>
      </section>

      {createOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h2 className="text-xl font-semibold">Yeni Personel</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <label className="text-sm">
                <div className="mb-1 font-medium">Personel No</div>
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={employeeNo} onChange={(e) => setEmployeeNo(e.target.value)} />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Ad *</div>
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Soyad *</div>
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Telefon</div>
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">E-posta</div>
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Ise giris tarihi</div>
                <input type="date" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Primary Sube</div>
                <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={primaryBranchId} onChange={(e) => setPrimaryBranchId(e.target.value)}>
                  <option value="">Seciniz</option>
                  {branches.filter((b) => b.is_active !== false).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.code ? `(${b.code})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Departman</div>
                <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                  <option value="">Seciniz</option>
                  {departments.filter((d) => d.is_active !== false).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={() => setCreateOpen(false)}>
                Vazgec
              </button>
              <button
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={loading || !firstName.trim() || !lastName.trim() || !primaryBranchId}
                onClick={createEmployee}
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
