const kpis = [
  { title: "Aktif Sube", value: "3 / 5", tone: "text-blue-700" },
  { title: "Aktif Kullanici", value: "12 / 50", tone: "text-emerald-700" },
  { title: "Aylik Satis", value: "1.245.000 TL", tone: "text-slate-900" },
  { title: "Hedef Gerceklesme", value: "%78", tone: "text-amber-700" },
];

const quickActions = [
  { href: "/tenant/hr/employees", label: "Personel Ekle", desc: "3 adimli akisla yeni personel olustur" },
  { href: "/tenant/organization/branches", label: "Sube Yonet", desc: "Sube ac, pasife al, atama yap" },
  { href: "/tenant/catalog", label: "Katalog Yonet", desc: "Kategori, marka ve urunleri yonet" },
  { href: "/tenant/rbac", label: "Rol ve Yetki", desc: "Rol matrisi ve atama kurallari" },
];

export default function TenantDashboardPage() {
  return (
    <div className="space-y-6">
      <section className="alpi-card p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
            <p className="mt-1 text-sm text-slate-600">
              Operasyon durumu, sinirlar ve hizli aksiyonlar tek ekranda.
            </p>
          </div>
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Abonelik kalan gun: <span className="font-semibold">24</span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <article key={kpi.title} className="alpi-card p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{kpi.title}</div>
            <div className={`mt-2 text-2xl font-semibold ${kpi.tone}`}>{kpi.value}</div>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="alpi-card p-5">
          <h2 className="text-lg font-semibold text-slate-900">Kurulum Durumu</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span>Sube olusturma</span>
              <span className="font-semibold text-emerald-700">Tamamlandi</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Mudur atama</span>
              <span className="font-semibold text-emerald-700">Tamamlandi</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Personel setup</span>
              <span className="font-semibold text-amber-700">Devam ediyor</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200">
              <div className="h-2 w-[68%] rounded-full bg-blue-600" />
            </div>
          </div>
        </article>

        <article className="alpi-card p-5">
          <h2 className="text-lg font-semibold text-slate-900">Hizli Aksiyonlar</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {quickActions.map((action) => (
              <a
                key={action.href}
                href={action.href}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-blue-300 hover:bg-blue-50"
              >
                <div className="text-sm font-semibold text-slate-900">{action.label}</div>
                <div className="mt-1 text-xs text-slate-600">{action.desc}</div>
              </a>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
