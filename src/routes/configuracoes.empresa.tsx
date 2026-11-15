import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { compressImage, loadCompany, saveCompany, type Company } from "@/lib/orders";

export const Route = createFileRoute("/configuracoes/empresa")({
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

function LogoField({ label, src, onPick, onRemove }: { label: string; src: string | null | undefined; onPick: (v: string) => void; onRemove: () => void }) {
  return (
    <>
      <h2 className="eyebrow">{label}</h2>
      <div className="flex items-center gap-4">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-border bg-background">
          {src ? <img src={src} alt="Logotipo" className="h-full w-full object-contain" /> : <span className="text-xs text-muted-foreground">Sem logo</span>}
        </div>
        <div className="flex flex-col gap-2">
          <label className="btn-ghost cursor-pointer">
            Escolher imagem
            <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) onPick(await compressImage(f, 500, "image/png")); }} />
          </label>
          {src && <button type="button" className="text-sm font-semibold text-obra-laranja-texto" onClick={onRemove}>Remover</button>}
        </div>
      </div>
    </>
  );
}

function CompanyPage() {
  const [c, setC] = useState<Company | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => setC(loadCompany()), []);
  if (!c) return null;
  const upd = (p: Partial<Company>) => { setC({ ...c, ...p }); setSaved(false); };

  return (
    <main className="mx-auto max-w-3xl px-4 pb-6 pt-5">
      <form className="panel space-y-4" onSubmit={(e) => { e.preventDefault(); saveCompany(c); setSaved(true); }}>
        <LogoField label="Logotipo principal" src={c.logo} onPick={(v) => upd({ logo: v })} onRemove={() => upd({ logo: null })} />
        <LogoField label="Segundo logotipo (opcional)" src={c.logo2} onPick={(v) => upd({ logo2: v })} onRemove={() => upd({ logo2: null })} />
        <LogoField label="Terceiro logotipo (opcional)" src={c.logo3} onPick={(v) => upd({ logo3: v })} onRemove={() => upd({ logo3: null })} />
        <input className="field" placeholder="Nome da empresa" value={c.name} onChange={(e) => upd({ name: e.target.value })} />
        <textarea className="field min-h-20" placeholder="CNPJ, telefone, endereço..." value={c.info} onChange={(e) => upd({ info: e.target.value })} />
        <button className="btn-primary w-full">{saved ? "Salvo ✓" : "Salvar"}</button>
      </form>
    </main>
  );
}
