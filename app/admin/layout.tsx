"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  const items = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/empreendimentos", label: "Empreendimentos" },
    { href: "/admin/avulsos", label: "Imóveis Avulsos" },
    { href: "/admin/corretores", label: "Gestão de Corretores" },
    { href: "/admin/leads", label: "Leads/Atendimento" },
  ];

  return (
    <div className="min-h-screen bg-white">
      <aside className="fixed left-0 top-0 h-screen w-72 bg-[#1e3a8a] px-5 py-6 text-white">
        <div className="mb-8">
          <div className="text-lg font-semibold tracking-tight">Área do Dono</div>
          <div className="text-xs text-white/80">CRM Imobiliário</div>
        </div>

        <nav className="flex flex-col gap-1">
          {items.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors " +
                  (isActive
                    ? "bg-white/15 text-white"
                    : "text-white/90 hover:bg-white/10 hover:text-white")
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="ml-72 min-h-screen bg-white px-8 py-10">{children}</main>
    </div>
  );
}
