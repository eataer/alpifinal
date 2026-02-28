"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
};

const navGroups: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Genel",
    items: [
      { href: "/tenant", label: "Dashboard" },
      { href: "/tenant/rbac", label: "Roller ve Yetkiler" },
    ],
  },
  {
    title: "Organizasyon",
    items: [
      { href: "/tenant/organization/branches", label: "Subeler" },
      { href: "/tenant/organization/departments", label: "Departmanlar" },
      { href: "/tenant/hr/employees", label: "Personel" },
    ],
  },
  {
    title: "Katalog",
    items: [{ href: "/tenant/catalog", label: "Kategori Marka Urun" }],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/tenant") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function TenantShellNav() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 h-screen border-r border-slate-200 bg-white/90 px-4 py-5 backdrop-blur">
      <div className="mb-6 px-2">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Alpi 360</div>
        <div className="mt-1 text-lg font-semibold text-slate-900">Tenant Panel</div>
      </div>

      <nav className="space-y-6">
        {navGroups.map((group) => (
          <div key={group.title}>
            <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {group.title}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block rounded-xl px-3 py-2.5 text-sm transition ${
                      active
                        ? "bg-blue-600 font-semibold text-white shadow-sm"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
