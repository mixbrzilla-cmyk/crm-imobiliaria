import Link from "next/link";
import {
  ClipboardCheck,
  Construction,
  Building2,
  ClipboardList,
  Gavel,
  Radar,
  Home,
  LayoutDashboard,
  Layers,
  MessageCircle,
  Settings,
  Users,
} from "lucide-react";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-[#F1F5F9]">
      <aside className="fixed left-0 top-0 h-screen w-72 border-r border-white/10 bg-[#001f3f] px-6 py-7 text-slate-100">
        <div className="mb-10">
          <div className="text-[13px] font-semibold tracking-[0.18em] text-slate-200/90">
            PAINEL DE CONTROLE
          </div>
          <div className="mt-2 text-xl font-semibold tracking-tight text-white">
            CRM Imobiliário
          </div>
          <div className="mt-1 text-xs text-slate-200/70">
            Gestão operacional • Inventário • Corretores
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          <Link
            href="/admin"
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-100/90 transition-all duration-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff0000]/40"
          >
            <LayoutDashboard className="h-4 w-4 text-slate-200/80 transition-all duration-300 group-hover:text-white" />
            Dashboard
          </Link>

          <Link
            href="/admin/whatsapp"
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-100/90 transition-all duration-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff0000]/40"
          >
            <MessageCircle className="h-4 w-4 text-slate-200/80 transition-all duration-300 group-hover:text-white" />
            Painel WhatsApp
          </Link>

          <Link
            href="/admin/whatsapp-config"
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-100/90 transition-all duration-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff0000]/40"
          >
            <Settings className="h-4 w-4 text-slate-200/80 transition-all duration-300 group-hover:text-white" />
            WhatsApp (Config)
          </Link>

          <Link
            href="/admin/imoveis"
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-100/90 transition-all duration-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff0000]/40"
          >
            <Layers className="h-4 w-4 text-slate-200/80 transition-all duration-300 group-hover:text-white" />
            Inventário (Imóveis)
          </Link>
          <Link
            href="/admin/empreendimentos"
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-100/90 transition-all duration-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff0000]/40"
          >
            <Building2 className="h-4 w-4 text-slate-200/80 transition-all duration-300 group-hover:text-white" />
            Empreendimentos
          </Link>
          <Link
            href="/admin/avulsos"
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-100/90 transition-all duration-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff0000]/40"
          >
            <Home className="h-4 w-4 text-slate-200/80 transition-all duration-300 group-hover:text-white" />
            Imóveis Avulsos
          </Link>
          <Link
            href="/admin/corretores"
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-100/90 transition-all duration-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff0000]/40"
          >
            <Users className="h-4 w-4 text-slate-200/80 transition-all duration-300 group-hover:text-white" />
            Gestão de Corretores
          </Link>
          <Link
            href="/admin/leads"
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-100/90 transition-all duration-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff0000]/40"
          >
            <ClipboardList className="h-4 w-4 text-slate-200/80 transition-all duration-300 group-hover:text-white" />
            Leads/Atendimento
          </Link>
          <Link
            href="/admin/gps"
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-100/90 transition-all duration-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff0000]/40"
          >
            <Radar className="h-4 w-4 text-slate-200/80 transition-all duration-300 group-hover:text-white" />
            GPS de Captação
          </Link>
          <Link
            href="/admin/obras"
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-100/90 transition-all duration-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff0000]/40"
          >
            <Construction className="h-4 w-4 text-slate-200/80 transition-all duration-300 group-hover:text-white" />
            Obras & Engenharia
          </Link>
          <Link
            href="/admin/avaliacoes"
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-100/90 transition-all duration-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff0000]/40"
          >
            <ClipboardCheck className="h-4 w-4 text-slate-200/80 transition-all duration-300 group-hover:text-white" />
            Avaliações
          </Link>
          <Link
            href="/admin/juridico"
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-100/90 transition-all duration-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff0000]/40"
          >
            <Gavel className="h-4 w-4 text-slate-200/80 transition-all duration-300 group-hover:text-white" />
            Jurídico
          </Link>
        </nav>
      </aside>

      <main className="ml-72 min-h-screen bg-[#F1F5F9] px-10 py-10">{children}</main>
    </div>
  );
}
