import Link from "next/link";

export default function PortaisAdminPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Central de Portais</h1>
        <p className="mt-2 text-sm text-slate-600">
          Hub operacional para gerenciar Inventário e Empreendimentos em um único ponto.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          href="/admin/imoveis"
          className="group rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:shadow-md"
        >
          <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">INVENTÁRIO</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">Imóveis</div>
          <div className="mt-1 text-sm text-slate-600">Cadastrar, editar e revisar o inventário disponível.</div>
          <div className="mt-4 text-sm font-semibold text-[#2b6cff]">Abrir Inventário →</div>
        </Link>

        <Link
          href="/admin/empreendimentos"
          className="group rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:shadow-md"
        >
          <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">EMPREENDIMENTOS</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">Lançamentos</div>
          <div className="mt-1 text-sm text-slate-600">Gerenciar catálogo, imagens e disponibilidade por projeto.</div>
          <div className="mt-4 text-sm font-semibold text-[#2b6cff]">Abrir Empreendimentos →</div>
        </Link>
      </div>

      <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-600 ring-1 ring-slate-200/70">
        Dica: use esta página como ponto de entrada para padronizar a rotina do time ao publicar e atualizar produtos nos portais.
      </div>
    </div>
  );
}
