"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { label: "Dashboard", href: "/" },
  { label: "Candidates", href: "/candidates" },
  { label: "Clients", href: "/clients" },
  { label: "Jobs", href: "/jobs" },
  { label: "Pipeline", href: "/pipeline" },
  { label: "Bulk Upload", href: "/bulk-upload" },
  { label: "Users", href: "/users" }
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white px-4 py-6 lg:block">
      <div className="mb-8 px-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recruitment Suite</p>
        <h1 className="mt-2 text-xl font-bold text-slate-900">Agodly ATS</h1>
      </div>

      <nav className="space-y-1">
        {items.map((item) => {
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "block rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-indigo-50 text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
