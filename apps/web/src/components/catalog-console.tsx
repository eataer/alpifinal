"use client";

import { useEffect, useMemo, useState } from "react";

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

type TabKey = "categories" | "brands" | "products";

type ProductImportRow = {
  sku?: string;
  name?: string;
  category_name?: string;
  brand_name?: string;
  model?: string;
  barcode?: string;
  tracking_type?: "none" | "serial" | "imei" | "iccid";
  sale_price?: number | null;
  min_sale_price?: number | null;
  cost_price?: number | null;
  vat_rate?: number | null;
  is_active?: boolean;
};

export default function CatalogConsole() {
  const [tenantSubdomain, setTenantSubdomain] = useState("demo");
  const [roleId, setRoleId] = useState("a581c118-66fb-439c-bbb3-1d8d5ed74c3b");
  const [includeInactive, setIncludeInactive] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("categories");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [productSearch, setProductSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("");
  const [productBrandFilter, setProductBrandFilter] = useState("");

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

  const [categoryCreateOpen, setCategoryCreateOpen] = useState(false);
  const [brandCreateOpen, setBrandCreateOpen] = useState(false);
  const [productCreateOpen, setProductCreateOpen] = useState(false);
  const [productImportOpen, setProductImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<"insert_only" | "upsert_by_sku">("upsert_by_sku");
  const [createMissingBrands, setCreateMissingBrands] = useState(true);
  const [importRaw, setImportRaw] = useState("");
  const [importSummary, setImportSummary] = useState<{
    total: number;
    created: number;
    updated: number;
    failed: number;
  } | null>(null);
  const [importErrors, setImportErrors] = useState<Array<{ row: number; code: string; message: string }>>([]);

  const baseQuery = useMemo(() => {
    const p = new URLSearchParams({
      tenant_subdomain: tenantSubdomain,
      role_id: roleId,
      include_inactive: includeInactive ? "true" : "false",
    });
    return p.toString();
  }, [tenantSubdomain, roleId, includeInactive]);

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const brandMap = useMemo(() => new Map(brands.map((b) => [b.id, b])), [brands]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const byCategory = !productCategoryFilter || p.category_id === productCategoryFilter;
      const byBrand = !productBrandFilter || p.brand_id === productBrandFilter;
      const q = productSearch.trim().toLowerCase();
      const bySearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode || "").toLowerCase().includes(q);
      return byCategory && byBrand && bySearch;
    });
  }, [products, productCategoryFilter, productBrandFilter, productSearch]);

  const activeCategoryCount = categories.filter((c) => c.is_active).length;
  const activeBrandCount = brands.filter((b) => b.is_active).length;
  const activeProductCount = products.filter((p) => p.is_active).length;

  useEffect(() => {
    // query degistiginde veriyi tazele
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseQuery]);

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
      setCategoryClass("product");
      setStockBehavior("none");
      setDefaultTracking("none");
      setCategoryCreateOpen(false);
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
      setBrandCreateOpen(false);
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
      setProductCreateOpen(false);
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

  function parseMaybeNumber(value: string) {
    const cleaned = value.trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned.replace(",", "."));
    return Number.isNaN(parsed) ? null : parsed;
  }

  function parseImportText(raw: string): ProductImportRow[] {
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      throw new Error("Import metni en az 1 baslik + 1 veri satiri icermeli.");
    }

    const headers = lines[0].split("\t").map((h) => h.trim().toLowerCase());
    const supported = new Set([
      "sku",
      "name",
      "category_name",
      "brand_name",
      "model",
      "barcode",
      "tracking_type",
      "sale_price",
      "min_sale_price",
      "cost_price",
      "vat_rate",
      "is_active",
    ]);

    headers.forEach((h) => {
      if (!supported.has(h)) {
        throw new Error(`Desteklenmeyen kolon: ${h}`);
      }
    });

    const rows: ProductImportRow[] = [];
    for (let i = 1; i < lines.length; i += 1) {
      const cols = lines[i].split("\t");
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = (cols[idx] || "").trim();
      });

      rows.push({
        sku: row.sku || undefined,
        name: row.name || undefined,
        category_name: row.category_name || undefined,
        brand_name: row.brand_name || undefined,
        model: row.model || undefined,
        barcode: row.barcode || undefined,
        tracking_type: (row.tracking_type as ProductImportRow["tracking_type"]) || undefined,
        sale_price: parseMaybeNumber(row.sale_price),
        min_sale_price: parseMaybeNumber(row.min_sale_price),
        cost_price: parseMaybeNumber(row.cost_price),
        vat_rate: parseMaybeNumber(row.vat_rate),
        is_active: row.is_active ? row.is_active.toLowerCase() === "true" : undefined,
      });
    }

    return rows;
  }

  function downloadImportTemplate() {
    const header = [
      "sku",
      "name",
      "category_name",
      "brand_name",
      "model",
      "barcode",
      "tracking_type",
      "sale_price",
      "min_sale_price",
      "cost_price",
      "vat_rate",
      "is_active",
    ].join("\t");

    const sample = [
      "IP15-128-BLK",
      "iPhone 15 128GB Siyah",
      "Akilli Telefon",
      "Apple",
      "A3090",
      "8690000000001",
      "imei",
      "62999",
      "60999",
      "58500",
      "20",
      "true",
    ].join("\t");

    const content = `${header}\n${sample}\n`;
    const blob = new Blob([content], { type: "text/tab-separated-values;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "alpi360_products_import_template.tsv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function importProducts() {
    setLoading(true);
    setError("");
    setImportSummary(null);
    setImportErrors([]);
    try {
      const rows = parseImportText(importRaw);
      const res = await fetch(`/api/modules/catalog/products/import?tenant_subdomain=${tenantSubdomain}&role_id=${roleId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: importMode,
          create_missing_brands: createMissingBrands,
          rows,
        }),
      });

      const data = (await res.json()) as {
        ok: boolean;
        code?: string;
        message?: string;
        summary?: { total: number; created: number; updated: number; failed: number };
        errors?: Array<{ row: number; code: string; message: string }>;
      };

      if (!data.ok) throw new Error(`${data.code || "ERROR"}: ${data.message || "Import failed"}`);

      setImportSummary(data.summary || null);
      setImportErrors(data.errors || []);
      await loadAll();
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
            <h1 className="text-2xl font-semibold">Katalog Yonetimi</h1>
            <p className="mt-1 text-sm text-slate-600">Kategori, marka ve urun master verilerini tek panelden yonet.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              onClick={loadAll}
              disabled={loading}
            >
              Yenile
            </button>
            {activeTab === "categories" ? (
              <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => setCategoryCreateOpen(true)}>
                Yeni Kategori
              </button>
            ) : null}
            {activeTab === "brands" ? (
              <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => setBrandCreateOpen(true)}>
                Yeni Marka
              </button>
            ) : null}
            {activeTab === "products" ? (
              <>
                <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100" onClick={() => setProductImportOpen(true)}>
                  Toplu Ice Aktar
                </button>
                <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => setProductCreateOpen(true)}>
                  Yeni Urun
                </button>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="alpi-card p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Aktif Kategori</div>
          <div className="mt-2 text-2xl font-semibold text-blue-700">{activeCategoryCount}</div>
        </article>
        <article className="alpi-card p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Aktif Marka</div>
          <div className="mt-2 text-2xl font-semibold text-emerald-700">{activeBrandCount}</div>
        </article>
        <article className="alpi-card p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Aktif Urun</div>
          <div className="mt-2 text-2xl font-semibold text-violet-700">{activeProductCount}</div>
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
          <label className="inline-flex items-center gap-2 text-sm xl:pt-7">
            <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
            Pasif kayitlari dahil et
          </label>
        </div>

        {error ? (
          <div className="mt-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        ) : null}
      </section>

      <section className="alpi-card overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {([
              ["categories", "Kategoriler"],
              ["brands", "Markalar"],
              ["products", "Urunler"],
            ] as Array<[TabKey, string]>).map(([key, label]) => (
              <button
                key={key}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  activeTab === key ? "bg-blue-600 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-100"
                }`}
                onClick={() => setActiveTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "categories" ? (
          <div className="max-h-[520px] overflow-auto px-2 py-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="px-2 py-2">Ad</th>
                  <th className="px-2 py-2">Parent</th>
                  <th className="px-2 py-2">Sinif</th>
                  <th className="px-2 py-2">Stock</th>
                  <th className="px-2 py-2">Tracking</th>
                  <th className="px-2 py-2">Durum</th>
                  <th className="px-2 py-2">Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100">
                    <td className="px-2 py-2 font-medium text-slate-900">{c.name}</td>
                    <td className="px-2 py-2 text-slate-700">{c.parent_id ? categoryMap.get(c.parent_id)?.name || "-" : "-"}</td>
                    <td className="px-2 py-2 text-slate-700">{c.category_class}</td>
                    <td className="px-2 py-2 text-slate-700">{c.stock_behavior}</td>
                    <td className="px-2 py-2 text-slate-700">{c.default_tracking_type}</td>
                    <td className="px-2 py-2">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${c.is_active ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                        {c.is_active ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <button className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100" onClick={() => toggleCategoryActive(c)}>
                        {c.is_active ? "Pasife Al" : "Aktif Et"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {activeTab === "brands" ? (
          <div className="max-h-[520px] overflow-auto px-2 py-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="px-2 py-2">Ad</th>
                  <th className="px-2 py-2">Durum</th>
                  <th className="px-2 py-2">Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((b) => (
                  <tr key={b.id} className="border-b border-slate-100">
                    <td className="px-2 py-2 font-medium text-slate-900">{b.name}</td>
                    <td className="px-2 py-2">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${b.is_active ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                        {b.is_active ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <button className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100" onClick={() => toggleBrandActive(b)}>
                        {b.is_active ? "Pasife Al" : "Aktif Et"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {activeTab === "products" ? (
          <div className="space-y-3 px-4 py-3">
            <div className="grid gap-3 md:grid-cols-3">
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Urun/SKU/Barkod ara"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
              <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={productCategoryFilter} onChange={(e) => setProductCategoryFilter(e.target.value)}>
                <option value="">Tum kategoriler</option>
                {categories.filter((c) => c.is_active || includeInactive).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={productBrandFilter} onChange={(e) => setProductBrandFilter(e.target.value)}>
                <option value="">Tum markalar</option>
                {brands.filter((b) => b.is_active || includeInactive).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="max-h-[460px] overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="px-2 py-2">Urun</th>
                    <th className="px-2 py-2">Kategori</th>
                    <th className="px-2 py-2">Marka</th>
                    <th className="px-2 py-2">SKU</th>
                    <th className="px-2 py-2">Tracking</th>
                    <th className="px-2 py-2">Satis Fiyati</th>
                    <th className="px-2 py-2">Durum</th>
                    <th className="px-2 py-2">Aksiyon</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="px-2 py-2 font-medium text-slate-900">
                        {p.name}
                        {p.model ? <div className="text-xs text-slate-500">{p.model}</div> : null}
                      </td>
                      <td className="px-2 py-2 text-slate-700">{categoryMap.get(p.category_id)?.name || "-"}</td>
                      <td className="px-2 py-2 text-slate-700">{p.brand_id ? brandMap.get(p.brand_id)?.name || "-" : "-"}</td>
                      <td className="px-2 py-2 font-mono text-xs text-slate-700">{p.sku}</td>
                      <td className="px-2 py-2 text-slate-700">{p.tracking_type}</td>
                      <td className="px-2 py-2 text-slate-700">{p.sale_price ?? "-"}</td>
                      <td className="px-2 py-2">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${p.is_active ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                          {p.is_active ? "Aktif" : "Pasif"}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <button className="rounded-lg border border-rose-300 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-40" disabled={!p.is_active} onClick={() => deactivateProduct(p.id)}>
                          Pasife Al
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      {categoryCreateOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h2 className="text-xl font-semibold">Yeni Kategori</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <label className="text-sm md:col-span-2">
                <div className="mb-1 font-medium">Kategori adi</div>
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Parent</div>
                <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={categoryParentId} onChange={(e) => setCategoryParentId(e.target.value)}>
                  <option value="">Ana kategori</option>
                  {categories.filter((c) => c.is_active).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Sinif</div>
                <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={categoryClass} onChange={(e) => setCategoryClass(e.target.value as typeof categoryClass)}>
                  <option value="product">product</option>
                  <option value="service">service</option>
                  <option value="transaction">transaction</option>
                </select>
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Stock behavior</div>
                <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={stockBehavior} onChange={(e) => setStockBehavior(e.target.value as typeof stockBehavior)}>
                  <option value="none">none</option>
                  <option value="decrease">decrease</option>
                  <option value="increase">increase</option>
                </select>
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Tracking default</div>
                <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={defaultTracking} onChange={(e) => setDefaultTracking(e.target.value as typeof defaultTracking)}>
                  <option value="none">none</option>
                  <option value="serial">serial</option>
                  <option value="imei">imei</option>
                  <option value="iccid">iccid</option>
                </select>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={() => setCategoryCreateOpen(false)}>
                Vazgec
              </button>
              <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={loading || !categoryName.trim()} onClick={createCategory}>
                Kaydet
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {brandCreateOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h2 className="text-xl font-semibold">Yeni Marka</h2>
            <label className="mt-4 block text-sm">
              <div className="mb-1 font-medium">Marka adi</div>
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={brandName} onChange={(e) => setBrandName(e.target.value)} />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={() => setBrandCreateOpen(false)}>
                Vazgec
              </button>
              <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={loading || !brandName.trim()} onClick={createBrand}>
                Kaydet
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {productCreateOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h2 className="text-xl font-semibold">Yeni Urun</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <label className="text-sm md:col-span-2">
                <div className="mb-1 font-medium">Urun adi</div>
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={productName} onChange={(e) => setProductName(e.target.value)} />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">SKU</div>
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={productSku} onChange={(e) => setProductSku(e.target.value)} />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Barkod</div>
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={productBarcode} onChange={(e) => setProductBarcode(e.target.value)} />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Kategori</div>
                <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={productCategoryId} onChange={(e) => setProductCategoryId(e.target.value)}>
                  <option value="">Seciniz</option>
                  {categories.filter((c) => c.is_active).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Marka</div>
                <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={productBrandId} onChange={(e) => setProductBrandId(e.target.value)}>
                  <option value="">Seciniz</option>
                  {brands.filter((b) => b.is_active).map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Model</div>
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={productModel} onChange={(e) => setProductModel(e.target.value)} />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Tracking</div>
                <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={productTracking} onChange={(e) => setProductTracking(e.target.value as typeof productTracking)}>
                  <option value="none">none</option>
                  <option value="serial">serial</option>
                  <option value="imei">imei</option>
                  <option value="iccid">iccid</option>
                </select>
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Satis fiyati</div>
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={productSalePrice} onChange={(e) => setProductSalePrice(e.target.value)} />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={() => setProductCreateOpen(false)}>
                Vazgec
              </button>
              <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={loading || !productName.trim() || !productSku.trim() || !productCategoryId} onClick={createProduct}>
                Kaydet
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {productImportOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Urun Toplu Ice Aktar</h2>
                <p className="mt-1 text-sm text-slate-600">Excel/Sheets verisini TSV olarak kopyalayip asagiya yapistir. Basliklar zorunludur.</p>
              </div>
              <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100" onClick={downloadImportTemplate}>
                Sablon Indir
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                <div className="mb-1 font-medium">Import modu</div>
                <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={importMode} onChange={(e) => setImportMode(e.target.value as typeof importMode)}>
                  <option value="upsert_by_sku">Var olani guncelle + yeniyi ekle</option>
                  <option value="insert_only">Sadece yeni ekle</option>
                </select>
              </label>
              <label className="inline-flex items-center gap-2 self-end text-sm">
                <input type="checkbox" checked={createMissingBrands} onChange={(e) => setCreateMissingBrands(e.target.checked)} />
                Marka yoksa olustur
              </label>
            </div>

            <div className="mt-4">
              <textarea
                className="h-56 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
                placeholder={
                  "sku\tname\tcategory_name\tbrand_name\tmodel\tbarcode\ttracking_type\tsale_price\tmin_sale_price\tcost_price\tvat_rate\tis_active\nIP15-128-BLK\tiPhone 15 128GB Siyah\tAkilli Telefon\tApple\tA3090\t8690000000001\timei\t62999\t60999\t58500\t20\ttrue"
                }
                value={importRaw}
                onChange={(e) => setImportRaw(e.target.value)}
              />
            </div>

            {importSummary ? (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                Toplam: {importSummary.total} | Olusan: {importSummary.created} | Guncellenen: {importSummary.updated} | Hatali: {importSummary.failed}
              </div>
            ) : null}

            {importErrors.length > 0 ? (
              <div className="mt-3 max-h-40 overflow-auto rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                {importErrors.slice(0, 20).map((er) => (
                  <div key={`${er.row}-${er.code}`}>
                    Satir {er.row}: {er.code} - {er.message}
                  </div>
                ))}
                {importErrors.length > 20 ? <div className="mt-1">... +{importErrors.length - 20} satir daha</div> : null}
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={() => setProductImportOpen(false)}>
                Kapat
              </button>
              <button
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={loading || !importRaw.trim()}
                onClick={importProducts}
              >
                Ice Aktar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
