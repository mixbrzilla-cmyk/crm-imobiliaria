export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6">
      <main className="flex w-full max-w-md flex-col items-center gap-10 py-16 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="text-3xl font-semibold tracking-tight text-[#1e3a8a]">
            CRM Imobiliário
          </div>
          <div className="text-sm text-zinc-500">Portal da Imobiliária</div>
        </div>

        <a
          className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-[#dc2626] px-5 text-base font-semibold text-white transition-colors hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a8a] focus-visible:ring-offset-2"
          href="/cadastro"
        >
          Acesso ao Portal
        </a>
      </main>
    </div>
  );
}
