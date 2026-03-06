import Link from "next/link";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-white">
      <aside className="fixed left-0 top-0 h-screen w-72 bg-[#1e3a8a] px-5 py-6 text-white">
        <div className="mb-8">
          <div className="text-lg font-semibold tracking-tight">Área do Dono</div>
          <div className="text-xs text-white/80">CRM Imobiliário</div>
        </div>

        <nav className="flex flex-col gap-1">
          <Link
            href="/admin"
            className="rounded-lg px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white"
          >
            Dashboard
          </Link>
          <Link
            href="/admin/empreendimentos"
            className="rounded-lg px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white"
          >
            Empreendimentos
          </Link>
          <Link
            href="/admin/avulsos"
            className="rounded-lg px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white"
          >
            Imóveis Avulsos
          </Link>
          <Link
            href="/admin/corretores"
            className="rounded-lg px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white"
          >
            Gestão de Corretores
          </Link>
          <Link
            href="/admin/leads"
            className="rounded-lg px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white"
          >
            Leads/Atendimento
          </Link>
        </nav>
      </aside>

      <main className="ml-72 min-h-screen bg-white px-8 py-10">{children}</main>
    </div>
  );
}
