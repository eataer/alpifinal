"use client";

import { useEffect, useMemo, useState } from "react";

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

type DeactivatePreview = {
  userCount: number;
  usersWithoutOtherActiveBranch: number;
  employeeCount: number;
};

export default function BranchesConsole() {
  const [tenantSubdomain, setTenantSubdomain] = useState("demo");
  const [roleId, setRoleId] = useState("a581c118-66fb-439c-bbb3-1d8d5ed74c3b");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editPhone, setEditPhone] = useState("");

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardBranchId, setWizardBranchId] = useState("");
  const [wizardBranchName, setWizardBranchName] = useState("");
  const [wizardPreview, setWizardPreview] = useState<DeactivatePreview | null>(null);
  const [moveUsers, setMoveUsers] = useState(true);
  const [targetBranchId, setTargetBranchId] = useState("");
  const [autoSetPrimary, setAutoSetPrimary] = useState(true);
  const [suspendNoBranch, setSuspendNoBranch] = useState(true);

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

  const filteredItems = useMemo(() => {
    return items.filter((branch) => {
      const bySearch =
        search.trim().length === 0 ||
        branch.name.toLowerCase().includes(search.toLowerCase()) ||
        branch.code.toLowerCase().includes(search.toLowerCase()) ||
        (branch.phone || "").toLowerCase().includes(search.toLowerCase());

      const byStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && branch.is_active) ||
        (statusFilter === "inactive" && !branch.is_active);

      return bySearch && byStatus;
    });
  }, [items, search, statusFilter]);

  const activeCount = items.filter((b) => b.is_active).length;
  const inactiveCount = items.length - activeCount;

  const activeTargets = useMemo(
    () => items.filter((b) => b.is_active && b.id !== wizardBranchId),
    [items, wizardBranchId],
  );

  useEffect(() => {
    // query degistiginde listeyi tazele
    void loadBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

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
      setCreateOpen(false);
      await loadBranches();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function openEdit(branch: BranchItem) {
    setEditId(branch.id);
    setEditName(branch.name);
    setEditAddress(branch.address || "");
    setEditPhone(branch.phone || "");
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editId) return;

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/modules/organization/branches/${editId}?${query}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, address: editAddress, phone: editPhone }),
      });

      const data = (await res.json()) as { ok: boolean; code?: string; message?: string };
      if (!data.ok) throw new Error(`${data.code || "ERROR"}: ${data.message || "Request failed"}`);

      setEditOpen(false);
      await loadBranches();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function openDeactivateWizard(branchId: string, branchName: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/modules/organization/branches/${branchId}/deactivate?${query}`);
      const data = (await res.json()) as {
        ok: boolean;
        code?: string;
        message?: string;
        preview?: DeactivatePreview;
      };

      if (!data.ok) throw new Error(`${data.code || "ERROR"}: ${data.message || "Request failed"}`);

      setWizardBranchId(branchId);
      setWizardBranchName(branchName);
      setWizardPreview(data.preview || null);
      setMoveUsers(true);
      setTargetBranchId("");
      setAutoSetPrimary(true);
      setSuspendNoBranch(true);
      setWizardOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function executeDeactivateWizard() {
    if (!wizardBranchId) return;

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/modules/organization/branches/${wizardBranchId}/deactivate?${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moveUsers,
          targetBranchId: moveUsers ? targetBranchId || undefined : undefined,
          autoSetPrimaryOnTarget: autoSetPrimary,
          suspendUsersWithoutActiveBranch: suspendNoBranch,
        }),
      });

      const data = (await res.json()) as { ok: boolean; code?: string; message?: string };
      if (!data.ok) throw new Error(`${data.code || "ERROR"}: ${data.message || "Request failed"}`);

      setWizardOpen(false);
      await loadBranches();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function activateBranch(branchId: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/modules/organization/branches/${branchId}/activate?${query}`, {
        method: "POST",
      });
      const data = (await res.json()) as { ok: boolean; code?: string; message?: string };
      if (!data.ok) throw new Error(`${data.code || "ERROR"}: ${data.message || "Request failed"}`);
      await loadBranches();
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
            <h1 className="text-2xl font-semibold">Sube Yonetimi</h1>
            <p className="mt-1 text-sm text-slate-600">
              Sube olusturma, duzenleme, pasife alma ve yeniden aktive etme islemleri.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              onClick={loadBranches}
              disabled={loading}
            >
              Yenile
            </button>
            <button
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              onClick={() => setCreateOpen(true)}
            >
              Yeni Sube
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="alpi-card p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Toplam Sube</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{items.length}</div>
        </article>
        <article className="alpi-card p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Aktif</div>
          <div className="mt-2 text-2xl font-semibold text-emerald-700">{activeCount}</div>
        </article>
        <article className="alpi-card p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Pasif</div>
          <div className="mt-2 text-2xl font-semibold text-amber-700">{inactiveCount}</div>
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
            <div className="mb-1 font-medium text-slate-700">Durum</div>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            >
              <option value="all">Tum durumlar</option>
              <option value="active">Sadece aktif</option>
              <option value="inactive">Sadece pasif</option>
            </select>
          </label>
        </div>

        <div className="mt-3">
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Sube adi, kodu veya telefon ile ara"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {error ? (
          <div className="mt-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
      </section>

      <section className="alpi-card overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-lg font-semibold">Sube Listesi</h2>
        </div>
        <div className="max-h-[480px] overflow-auto px-2 py-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-600">
                <th className="px-2 py-2">Sube</th>
                <th className="px-2 py-2">Kod</th>
                <th className="px-2 py-2">Adres</th>
                <th className="px-2 py-2">Telefon</th>
                <th className="px-2 py-2">Durum</th>
                <th className="px-2 py-2">Aksiyon</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((branch) => (
                <tr key={branch.id} className="border-b border-slate-100">
                  <td className="px-2 py-2 font-medium text-slate-900">{branch.name}</td>
                  <td className="px-2 py-2 font-mono text-xs text-slate-700">{branch.code}</td>
                  <td className="px-2 py-2 text-slate-700">{branch.address || "-"}</td>
                  <td className="px-2 py-2 text-slate-700">{branch.phone || "-"}</td>
                  <td className="px-2 py-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        branch.is_active
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {branch.is_active ? "Aktif" : "Pasif"}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        onClick={() => openEdit(branch)}
                      >
                        Duzenle
                      </button>
                      {branch.is_active ? (
                        <button
                          className="rounded-lg border border-rose-300 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                          onClick={() => openDeactivateWizard(branch.id, branch.name)}
                        >
                          Pasife Al
                        </button>
                      ) : (
                        <button
                          className="rounded-lg border border-emerald-300 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                          onClick={() => activateBranch(branch.id)}
                        >
                          Aktif Et
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredItems.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-slate-500">Filtreye uygun sube bulunamadi.</div>
          ) : null}
        </div>
      </section>

      {createOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h2 className="text-xl font-semibold">Yeni Sube Olustur</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                <div className="mb-1 font-medium">Sube adi</div>
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Sube kodu</div>
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={code} onChange={(e) => setCode(e.target.value)} />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Adres</div>
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={address} onChange={(e) => setAddress(e.target.value)} />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Telefon</div>
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={() => setCreateOpen(false)}>
                Vazgec
              </button>
              <button
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={loading || !name.trim() || !code.trim()}
                onClick={createBranch}
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editOpen ? (
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md border-l border-slate-200 bg-white p-5 shadow-2xl">
          <h2 className="text-xl font-semibold">Sube Duzenle</h2>
          <div className="mt-4 space-y-3">
            <label className="text-sm">
              <div className="mb-1 font-medium">Sube adi</div>
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </label>
            <label className="text-sm">
              <div className="mb-1 font-medium">Adres</div>
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
            </label>
            <label className="text-sm">
              <div className="mb-1 font-medium">Telefon</div>
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            </label>
          </div>
          <div className="mt-6 flex gap-2">
            <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={() => setEditOpen(false)}>
              Kapat
            </button>
            <button
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              disabled={loading || !editName.trim()}
              onClick={saveEdit}
            >
              Degisiklikleri Kaydet
            </button>
          </div>
        </div>
      ) : null}

      {wizardOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-rose-200 bg-white p-5 shadow-xl">
            <h2 className="text-xl font-semibold text-rose-800">Sube Pasiflestirme</h2>
            <p className="mt-1 text-sm text-slate-600">Sube: {wizardBranchName}</p>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="text-slate-500">Kullanici</div>
                <div className="mt-1 text-lg font-semibold">{wizardPreview?.userCount ?? 0}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="text-slate-500">Aktif subesi kalmayacak</div>
                <div className="mt-1 text-lg font-semibold">{wizardPreview?.usersWithoutOtherActiveBranch ?? 0}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="text-slate-500">Personel</div>
                <div className="mt-1 text-lg font-semibold">{wizardPreview?.employeeCount ?? 0}</div>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={moveUsers} onChange={(e) => setMoveUsers(e.target.checked)} />
                Kullanicilari hedef subeye kaydir
              </label>

              {moveUsers ? (
                <label className="block">
                  <div className="mb-1 font-medium">Hedef sube</div>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    value={targetBranchId}
                    onChange={(e) => setTargetBranchId(e.target.value)}
                  >
                    <option value="">Seciniz</option>
                    {activeTargets.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className="flex items-center gap-2">
                <input type="checkbox" checked={autoSetPrimary} onChange={(e) => setAutoSetPrimary(e.target.checked)} />
                Primary branch hedef sube olsun
              </label>

              <label className="flex items-center gap-2">
                <input type="checkbox" checked={suspendNoBranch} onChange={(e) => setSuspendNoBranch(e.target.checked)} />
                Aktif subesi kalmayan kullanicilar suspended olsun
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={() => setWizardOpen(false)}>
                Vazgec
              </button>
              <button
                className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={executeDeactivateWizard}
                disabled={loading || (moveUsers && !targetBranchId)}
              >
                Pasife Al
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
