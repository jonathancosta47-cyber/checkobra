import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { compressImage, loadCompany, saveCompany, type Company } from "@/lib/orders";

export const Route = createFileRoute("/empresa")({
  head: () => ({
    meta: [
      { title: "Dados da Empresa — Ordens de Serviço" },
      { name: "description", content: "Configure o logotipo e os dados da sua empresa nas ordens de serviço." },
      { property: "og:title", content: "Dados da Empresa" },
      { property: "og:description", content: "Logotipo e dados da empresa para as OS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompanyPage,
});

function CompanyPage() {
  const [c, setC] = useState<Company | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => setC(loadCompany()), []);
  if (!c) return null;
  const upd = (p: Partial<Company>) => { setC({ ...c, ...p }); setSaved(false); };

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
      <Link to="/" className="text-sm text-muted-foreground">← Voltar</Link>
      <h1 className="mb-6 mt-2 font-display text-3xl font-bold">Minha empresa</h1>
      <form className="panel space-y-4" onSubmit={(e) => { e.preventDefault(); saveCompany(c); setSaved(true); }}>
        <h2 className="eyebrow">Logotipo principal</h2>
        <div className="flex items-center gap-4">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-border bg-background">
            {c.logo ? <img src={c.logo} alt="Logotipo" className="h-full w-full object-contain" /> : <span className="text-xs text-muted-foreground">Sem logo</span>}
          </div>
          <div className="flex flex-col gap-2">
            <label className="btn-ghost cursor-pointer">
              Escolher imagem
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) upd({ logo: await compressImage(f, 500, "image/png") }); }} />
            </label>
            {c.logo && <button type="button" className="text-sm font-semibold text-primary" onClick={() => upd({ logo: null })}>Remover</button>}
          </div>
        </div>
        <h2 className="eyebrow">Segundo logotipo (opcional)</h2>
        <div className="flex items-center gap-4">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-border bg-background">
            {c.logo2 ? <img src={c.logo2} alt="Logotipo" className="h-full w-full object-contain" /> : <span className="text-xs text-muted-foreground">Sem logo</span>}
          </div>
          <div className="flex flex-col gap-2">
            <label className="btn-ghost cursor-pointer">
              Escolher imagem
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) upd({ logo2: await compressImage(f, 500, "image/png") }); }} />
            </label>
            {c.logo2 && <button type="button" className="text-sm font-semibold text-primary" onClick={() => upd({ logo2: null })}>Remover</button>}
          </div>
        </div>
        <input className="field" placeholder="Nome da empresa" value={c.name} onChange={(e) => upd({ name: e.target.value })} />
        <textarea className="field min-h-20" placeholder="CNPJ, telefone, endereço..." value={c.info} onChange={(e) => upd({ info: e.target.value })} />
        <button className="btn-primary w-full">{saved ? "Salvo ✓" : "Salvar"}</button>
      </form>
    </main>
  );
}
