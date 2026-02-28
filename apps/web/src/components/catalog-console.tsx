"use client";

import { useMemo, useState } from "react";

type Category = {
  id: string;
  name: string;
  parent_id: string | null;
  category_class: "product" | "service" | "transaction";
  stock_behavior: "decrease" | "increase" | "none";
  default_tracking_type: "none" | "serial" | "imei" | "iccid";
  is_active: boolean;
};

type Brand = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

type Product = {
  id: string;
  name: string;
  category_id: string;
  brand_id: string | null;
  model: string | null;
  sku: string;
  barcode: string | null;
  tracking_type: "none" | "serial" | "imei" | "iccid";
  sale_price: number | null;
  is_active: boolean;
};

export default function CatalogConsole() {
  const [tenantSubdomain, setTenantSubdomain] = useState("demo");
  const [roleId, setRoleId] = useState("a581c118-66fb-439c-bbb3-1d8d5ed74c3b");
  const [includeInactive, setIncludeInactive] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [categoryName, setCategoryName] = useState("");
  const [categoryParentId, setCategoryParentId] = useState("");
  const [categoryClass, setCategoryClass] = useState<"product" | "service" | "transaction">("product");
  const [stockBehavior, setStockBehavior] = useState<"decrease" | "increase" | "none">("none");
  const [defaultTracking, setDefaultTracking] = useState<"none" | "serial" | "imei" | "iccid">("none");

  const [brandName, setBrandName] = useState("");

  const [productName, setProductName] = useState("");
  const [productSku, setProductSku] = useState("");
  const [productCategoryId, setProductCategoryId] = useState("");
  const [productBrandId, setProductBrandId] = useState("");
  const [productModel, setProductModel] = useState("");
  const [productBarcode, setProductBarcode] = useState("");
  const [productTracking, setProductTracking] = useState<"none" | "serial" | "imei" | "iccid">("none");
  const [productSalePrice, setProductSalePrice] = useState("");

  const baseQuery = useMemo(() => {
    const p = new URLSearchParams({
      tenant_subdomain: tenantSubdomain,
      role_id: roleId,
      include_inactive: includeInactive ? "true" : "false",
    });
    return p.toString();
  }, [tenantSubdomain, roleId, includeInactive]);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [catRes, brdRes, prdRes] = await Promise.all([
        fetch(`/api/modules/catalog/categories?${baseQuery}`, { cache: "no-store" }),
        fetch(`/api/modules/catalog/brands?${baseQuery}`, { cache: "no-store" }),
        fetch(`/api/modules/catalog/products?${baseQuery}`, { cache: "no-store" }),
      ]);

      const cat = (await catRes.json()) as { ok: boolean; items?: Category[]; code?: string; message?: string };
      const brd = (await brdRes.json()) as { ok: boolean; items?: Brand[]; code?: string; message?: string };
      const prd = (await prdRes.json()) as { ok: boolean; items?: Product[]; code?: string; message?: string };

      if (!cat.ok) throw new Error(`${cat.code || "ERROR"}: ${cat.message || "Failed to load categories"}`);
      if (!brd.ok) throw new Error(`${brd.code || "ERROR"}: ${brd.message || "Failed to load brands"}`);
      if (!prd.ok) throw new Error(`${prd.code || "ERROR"}: ${prd.message || "Failed to load products"}`);

      setCategories(cat.items || []);
      setBrands(brd.items || []);
      setProducts(prd.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function createCategory() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/modules/catalog/categories?tenant_subdomain=${tenantSubdomain}&role_id=${roleId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: categoryName,
          parentId: categoryParentId || null,
          categoryClass,
          stockBehavior,
          defaultTrackingType: defaultTracking,
        }),
      });
      const data = (await res.json()) as { ok: boolean; code?: string; message?: string };
      if (!data.ok) throw new Error(`${data.code || "ERROR"}: ${data.message || "Failed"}`);
      setCategoryName("");
      setCategoryParentId("");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function toggleCategoryActive(c: Category) {
    setLoading(true);
    setError("");
    try {
      const endpoint = c.is_active ? "deactivate" : "activate";
      const res = await fetch(
        `/api/modules/catalog/categories/${c.id}/${endpoint}?tenant_subdomain=${tenantSubdomain}&role_id=${roleId}`,
        { method: "POST" },
      );
      const data = (await res.json()) as { ok: boolean; code?: string; message?: string };
      if (!data.ok) throw new Error(`${data.code || "ERROR"}: ${data.message || "Failed"}`);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function createBrand() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/modules/catalog/brands?tenant_subdomain=${tenantSubdomain}&role_id=${roleId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: brandName }),
      });
      const data = (await res.json()) as { ok: boolean; code?: string; message?: string };
      if (!data.ok) throw new Error(`${data.code || "ERROR"}: ${data.message || "Failed"}`);
      setBrandName("");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function toggleBrandActive(b: Brand) {
    setLoading(true);
    setError("");
    try {
      const endpoint = b.is_active ? "deactivate" : "activate";
      const res = await fetch(
        `/api/modules/catalog/brands/${b.id}/${endpoint}?tenant_subdomain=${tenantSubdomain}&role_id=${roleId}`,
        { method: "POST" },
      );
      const data = (await res.json()) as { ok: boolean; code?: string; message?: string };
      if (!data.ok) throw new Error(`${data.code || "ERROR"}: ${data.message || "Failed"}`);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function createProduct() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/modules/catalog/products?tenant_subdomain=${tenantSubdomain}&role_id=${roleId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: productName,
          sku: productSku,
          categoryId: productCategoryId,
          brandId: productBrandId || null,
          model: productModel || null,
          barcode: productBarcode || null,
          trackingType: productTracking,
          salePrice: productSalePrice ? Number(productSalePrice) : null,
        }),
      });
      const data = (await res.json()) as { ok: boolean; code?: string; message?: string };
      if (!data.ok) throw new Error(`${data.code || "ERROR"}: ${data.message || "Failed"}`);

      setProductName("");
      setProductSku("");
      setProductCategoryId("");
      setProductBrandId("");
      setProductModel("");
      setProductBarcode("");
      setProductTracking("none");
      setProductSalePrice("");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function deactivateProduct(id: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/modules/catalog/products/${id}/deactivate?tenant_subdomain=${tenantSubdomain}&role_id=${roleId}`,
        { method: "POST" },
      );
      const data = (await res.json()) as { ok: boolean; code?: string; message?: string };
      if (!data.ok) throw new Error(`${data.code || "ERROR"}: ${data.message || "Failed"}`);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <h1 className="text-3xl font-bold">Catalog Console (Phase 2)</h1>

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
          <label className="mt-3 inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
            Pasif kayıtları da göster
          </label>
          <div className="mt-4">
            <button className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white" onClick={loadAll} disabled={loading}>
              Katalog Verisini Yükle
            </button>
          </div>
          {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">Kategori Yönetimi</h2>
          <div className="grid gap-3 md:grid-cols-5">
            <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Kategori adı" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} />
            <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={categoryParentId} onChange={(e) => setCategoryParentId(e.target.value)}>
              <option value="">Ana kategori</option>
              {categories.filter((c) => c.is_active).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={categoryClass} onChange={(e) => setCategoryClass(e.target.value as typeof categoryClass)}>
              <option value="product">product</option>
              <option value="service">service</option>
              <option value="transaction">transaction</option>
            </select>
            <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={stockBehavior} onChange={(e) => setStockBehavior(e.target.value as typeof stockBehavior)}>
              <option value="none">stock: none</option>
              <option value="decrease">stock: decrease</option>
              <option value="increase">stock: increase</option>
            </select>
            <div className="flex gap-2">
              <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={defaultTracking} onChange={(e) => setDefaultTracking(e.target.value as typeof defaultTracking)}>
                <option value="none">tracking: none</option>
                <option value="serial">tracking: serial</option>
                <option value="imei">tracking: imei</option>
                <option value="iccid">tracking: iccid</option>
              </select>
              <button className="rounded-md bg-indigo-700 px-3 py-2 text-sm text-white" onClick={createCategory} disabled={loading || !categoryName.trim()}>
                Ekle
              </button>
            </div>
          </div>
          <div className="mt-4 max-h-60 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="py-2">Ad</th><th className="py-2">Sınıf</th><th className="py-2">Tracking</th><th className="py-2">Durum</th><th className="py-2">Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100">
                    <td className="py-2">{c.name}</td>
                    <td className="py-2">{c.category_class}</td>
                    <td className="py-2">{c.default_tracking_type}</td>
                    <td className="py-2">{c.is_active ? "Aktif" : "Pasif"}</td>
                    <td className="py-2">
                      <button className="rounded border border-slate-300 px-2 py-1" onClick={() => toggleCategoryActive(c)}>{c.is_active ? "Pasife Al" : "Aktif Et"}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">Marka Yönetimi</h2>
          <div className="flex gap-2">
            <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Marka adı" value={brandName} onChange={(e) => setBrandName(e.target.value)} />
            <button className="rounded-md bg-indigo-700 px-3 py-2 text-sm text-white" onClick={createBrand} disabled={loading || !brandName.trim()}>
              Ekle
            </button>
          </div>
          <div className="mt-4 max-h-60 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="py-2">Ad</th><th className="py-2">Durum</th><th className="py-2">Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((b) => (
                  <tr key={b.id} className="border-b border-slate-100">
                    <td className="py-2">{b.name}</td>
                    <td className="py-2">{b.is_active ? "Aktif" : "Pasif"}</td>
                    <td className="py-2">
                      <button className="rounded border border-slate-300 px-2 py-1" onClick={() => toggleBrandActive(b)}>{b.is_active ? "Pasife Al" : "Aktif Et"}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">Ürün Yönetimi</h2>
          <div className="grid gap-3 md:grid-cols-4">
            <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Ürün adı" value={productName} onChange={(e) => setProductName(e.target.value)} />
            <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="SKU" value={productSku} onChange={(e) => setProductSku(e.target.value)} />
            <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={productCategoryId} onChange={(e) => setProductCategoryId(e.target.value)}>
              <option value="">Kategori seç</option>
              {categories.filter((c) => c.is_active).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={productBrandId} onChange={(e) => setProductBrandId(e.target.value)}>
              <option value="">Marka (ops.)</option>
              {brands.filter((b) => b.is_active).map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Model" value={productModel} onChange={(e) => setProductModel(e.target.value)} />
            <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Barkod" value={productBarcode} onChange={(e) => setProductBarcode(e.target.value)} />
            <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={productTracking} onChange={(e) => setProductTracking(e.target.value as typeof productTracking)}>
              <option value="none">tracking none</option>
              <option value="serial">tracking serial</option>
              <option value="imei">tracking imei</option>
              <option value="iccid">tracking iccid</option>
            </select>
            <div className="flex gap-2">
              <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Satış fiyatı" value={productSalePrice} onChange={(e) => setProductSalePrice(e.target.value)} />
              <button
                className="rounded-md bg-indigo-700 px-3 py-2 text-sm text-white"
                onClick={createProduct}
                disabled={loading || !productName.trim() || !productSku.trim() || !productCategoryId}
              >
                Ekle
              </button>
            </div>
          </div>
          <div className="mt-4 max-h-72 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="py-2">Ürün</th><th className="py-2">SKU</th><th className="py-2">Tracking</th><th className="py-2">Fiyat</th><th className="py-2">Durum</th><th className="py-2">Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="py-2">{p.name}</td>
                    <td className="py-2">{p.sku}</td>
                    <td className="py-2">{p.tracking_type}</td>
                    <td className="py-2">{p.sale_price ?? "-"}</td>
                    <td className="py-2">{p.is_active ? "Aktif" : "Pasif"}</td>
                    <td className="py-2">
                      <button className="rounded border border-rose-300 px-2 py-1 text-rose-700 disabled:opacity-40" disabled={!p.is_active} onClick={() => deactivateProduct(p.id)}>
                        Pasife Al
                      </button>
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
