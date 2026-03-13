"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ClipboardCheck,
  Construction,
  Building2,
  ClipboardList,
  Gavel,
  FileSignature,
  LayoutDashboard,
  Layers,
  MessageCircle,
  Users,
  Home,
} from "lucide-react";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsNavOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-[#F1F5F9]">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200/70 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setIsNavOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#001f3f] text-white shadow-sm"
          aria-label="Abrir menu"
          title="Menu"
        >
          <span className="text-lg leading-none">≡</span>
        </button>

        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">CRM Imobiliária Moderna</div>
          <div className="truncate text-xs text-slate-500">Painel do Admin</div>
        </div>

        <div className="h-10 w-10" />
      </header>

      {isNavOpen ? (
        <button
          type="button"
          onClick={() => setIsNavOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-label="Fechar menu"
        />
      ) : null}

      <aside
        className={
          "fixed left-0 top-0 z-50 h-screen w-72 border-r border-white/10 bg-[#001f3f] px-6 py-7 text-slate-100 transition-transform duration-300 lg:translate-x-0 " +
          (isNavOpen ? "translate-x-0" : "-translate-x-full")
        }
      >
        <div className="mb-10">
          <div className="text-[13px] font-semibold tracking-[0.18em] text-slate-200/90">
            PAINEL DE CONTROLE
          </div>
          <div className="mt-4 flex items-center gap-3">
            <img
              src="https://imobmoderna.com.br/wp-content/uploads/2026/03/Sem-Titulo-2-1024x1024-1.png"
              alt="Imobiliária Moderna"
              className="h-10 w-10 rounded-full bg-white object-cover ring-2 ring-white/20"
            />
            <div className="text-xl font-semibold tracking-tight text-white">
              CRM Imobiliária Moderna
            </div>
          </div>
          <div className="mt-1 text-xs text-slate-200/70">
            Gestão operacional • Inventário • Corretores
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          <Link
            href="/admin"
            onClick={() => setIsNavOpen(false)}
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-100/90 transition-all duration-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff0000]/40"
          >
            <LayoutDashboard className="h-4 w-4 text-slate-200/80 transition-all duration-300 group-hover:text-white" />
            Dashboard
          </Link>

          <Link
            href="/admin/whatsapp"
            onClick={() => setIsNavOpen(false)}
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-100/90 transition-all duration-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff0000]/40"
          >
            <MessageCircle className="h-4 w-4 text-slate-200/80 transition-all duration-300 group-hover:text-white" />
            Painel WhatsApp
          </Link>

          <Link
            href="/admin/imoveis"
            onClick={() => setIsNavOpen(false)}
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-100/90 transition-all duration-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff0000]/40"
          >
            <Layers className="h-4 w-4 text-slate-200/80 transition-all duration-300 group-hover:text-white" />
            Inventário
          </Link>

          <Link
            href="/admin/empreendimentos"
            onClick={() => setIsNavOpen(false)}
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-100/90 transition-all duration-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff0000]/40"
          >
            <Building2 className="h-4 w-4 text-slate-200/80 transition-all duration-300 group-hover:text-white" />
            Empreendimentos
          </Link>

          <Link
            href="/admin/portais"
            onClick={() => setIsNavOpen(false)}
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-100/90 transition-all duration-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff0000]/40"
          >
            <Home className="h-4 w-4 text-slate-200/80 transition-all duration-300 group-hover:text-white" />
            Central de Portais
          </Link>

          <Link
            href="/admin/corretores"
            onClick={() => setIsNavOpen(false)}
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-100/90 transition-all duration-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff0000]/40"
          >
            <Users className="h-4 w-4 text-slate-200/80 transition-all duration-300 group-hover:text-white" />
            Gestão de Corretores
          </Link>
          <Link
            href="/admin/leads"
            onClick={() => setIsNavOpen(false)}
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-100/90 transition-all duration-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff0000]/40"
          >
            <ClipboardList className="h-4 w-4 text-slate-200/80 transition-all duration-300 group-hover:text-white" />
            Leads
          </Link>

          <Link
            href="/admin/contratos"
            onClick={() => setIsNavOpen(false)}
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-100/90 transition-all duration-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff0000]/40"
          >
            <FileSignature className="h-4 w-4 text-slate-200/80 transition-all duration-300 group-hover:text-white" />
            Contratos
          </Link>

          <Link
            href="/admin/obras"
            onClick={() => setIsNavOpen(false)}
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-100/90 transition-all duration-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff0000]/40"
          >
            <Construction className="h-4 w-4 text-slate-200/80 transition-all duration-300 group-hover:text-white" />
            Gastos
          </Link>
          <Link
            href="/admin/avaliacoes"
            onClick={() => setIsNavOpen(false)}
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-100/90 transition-all duration-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff0000]/40"
          >
            <ClipboardCheck className="h-4 w-4 text-slate-200/80 transition-all duration-300 group-hover:text-white" />
            Avaliações
          </Link>
          <Link
            href="/admin/juridico"
            onClick={() => setIsNavOpen(false)}
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-100/90 transition-all duration-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff0000]/40"
          >
            <Gavel className="h-4 w-4 text-slate-200/80 transition-all duration-300 group-hover:text-white" />
            Jurídico
          </Link>
        </nav>
      </aside>

      <main className="min-h-screen bg-[#F1F5F9] px-4 py-6 lg:ml-72 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}
