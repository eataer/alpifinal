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

type DeactivatePreview = {
  userCount: number;
  usersWithoutOtherActiveBranch: number;
  employeeCount: number;
};

export default function BranchesConsole() {
  const [tenantSubdomain, setTenantSubdomain] = useState("demo");
  const [roleId, setRoleId] = useState("a581c118-66fb-439c-bbb3-1d8d5ed74c3b");

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  const [editId, setEditId] = useState<string>("");
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editPhone, setEditPhone] = useState("");

  const [wizardBranchId, setWizardBranchId] = useState<string>("");
  const [wizardBranchName, setWizardBranchName] = useState<string>("");
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

      setEditId("");
      setEditName("");
      setEditAddress("");
      setEditPhone("");

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

      setWizardBranchId("");
      setWizardBranchName("");
      setWizardPreview(null);
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

  const activeTargets = items.filter((b) => b.is_active && b.id !== wizardBranchId);

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
                  <th className="py-2">Aksiyon</th>
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
                    <td className="py-2">
                      <div className="flex gap-2">
                        <button
                          className="rounded border border-slate-300 px-2 py-1"
                          onClick={() => {
                            setEditId(branch.id);
                            setEditName(branch.name);
                            setEditAddress(branch.address || "");
                            setEditPhone(branch.phone || "");
                          }}
                        >
                          Düzenle
                        </button>
                        {branch.is_active ? (
                          <button
                            className="rounded border border-rose-300 px-2 py-1 text-rose-700"
                            onClick={() => openDeactivateWizard(branch.id, branch.name)}
                          >
                            Pasife Al
                          </button>
                        ) : (
                          <button
                            className="rounded border border-emerald-300 px-2 py-1 text-emerald-700"
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
          </div>
        </section>

        {editId ? (
          <section className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
            <h2 className="mb-3 text-lg font-semibold">Şube Düzenle</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                <div className="mb-1 font-medium">Şube adı</div>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Adres</div>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                />
              </label>
              <label className="text-sm md:col-span-2">
                <div className="mb-1 font-medium">Telefon</div>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button className="rounded-md bg-indigo-700 px-3 py-2 text-sm text-white" onClick={saveEdit} disabled={loading}>
                Kaydet
              </button>
              <button
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                onClick={() => {
                  setEditId("");
                  setEditName("");
                  setEditAddress("");
                  setEditPhone("");
                }}
              >
                Vazgeç
              </button>
            </div>
          </section>
        ) : null}

        {wizardBranchId ? (
          <section className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <h2 className="mb-3 text-lg font-semibold">Şube Pasifleştirme Sihirbazı</h2>
            <p className="text-sm">Şube: <span className="font-medium">{wizardBranchName}</span></p>
            <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
              <div className="rounded border border-rose-200 bg-white p-2">Kullanıcı: {wizardPreview?.userCount ?? 0}</div>
              <div className="rounded border border-rose-200 bg-white p-2">Aktif şubesi kalmayacak kullanıcı: {wizardPreview?.usersWithoutOtherActiveBranch ?? 0}</div>
              <div className="rounded border border-rose-200 bg-white p-2">Personel: {wizardPreview?.employeeCount ?? 0}</div>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={moveUsers} onChange={(e) => setMoveUsers(e.target.checked)} />
                Kullanıcıları hedef şubeye kaydır
              </label>

              {moveUsers ? (
                <label className="block">
                  <div className="mb-1">Hedef şube</div>
                  <select
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                    value={targetBranchId}
                    onChange={(e) => setTargetBranchId(e.target.value)}
                  >
                    <option value="">Seçiniz</option>
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
                Primary branch otomatik hedefe taşınsın
              </label>

              <label className="flex items-center gap-2">
                <input type="checkbox" checked={suspendNoBranch} onChange={(e) => setSuspendNoBranch(e.target.checked)} />
                Aktif şubesi kalmayan kullanıcılar suspended olsun
              </label>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                className="rounded-md bg-rose-700 px-3 py-2 text-sm text-white"
                onClick={executeDeactivateWizard}
                disabled={loading || (moveUsers && !targetBranchId)}
              >
                Pasife Al
              </button>
              <button
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                onClick={() => {
                  setWizardBranchId("");
                  setWizardBranchName("");
                  setWizardPreview(null);
                }}
              >
                Kapat
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
