import { forwardRef, useEffect, useState } from "react";
import { CompanyHeader } from "@/components/CompanyHeader";
import { ReportPhotos } from "@/components/ReportPhotos";
import { loadCompany, type Company } from "@/lib/orders";
import { formatarCnpj } from "@/lib/configuracoes";
import { contarRespostas, numeroFvs, PAPEL_ASSINATURA, RESULTADO_ROTULO, type FotoFvs, type Inspecao, type Resultado } from "@/lib/fvs-db";

const COR: Record<Resultado, string> = {
  C: "bg-obra-ok-fundo text-obra-ok",
  NC: "bg-obra-nc-fundo text-obra-nc",
  NA: "bg-obra-fundo text-obra-grafite",
};

// As fotos do Storage viram endereços locais (blob:) antes de entrar no PDF:
// assim o html2canvas não esbarra em restrições de outro domínio.
export function useFotosLocais(fotos: FotoFvs[]) {
  const [locais, setLocais] = useState<Record<string, string>>({});
  const chave = fotos.map((f) => f.id + f.url).join("|");
  useEffect(() => {
    let ativo = true;
    const criadas: string[] = [];
    Promise.all(
      fotos.map(async (f) => {
        if (!f.url) return [f.id, ""] as const;
        try {
          const blob = await (await fetch(f.url)).blob();
          const u = URL.createObjectURL(blob);
          criadas.push(u);
          return [f.id, u] as const;
        } catch {
          return [f.id, f.url] as const;
        }
      }),
    ).then((pares) => {
      if (ativo) setLocais(Object.fromEntries(pares));
    });
    return () => {
      ativo = false;
      criadas.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  return locais;
}

const Campo = ({ rotulo, valor }: { rotulo: string; valor: string }) => (
  <div data-pdf-block>
    <p className="text-xs text-muted-foreground">{rotulo}</p>
    <p className="break-words font-semibold">{valor || "—"}</p>
  </div>
);

const data = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "");

// Relatório da FVS (tela e PDF): identificação, itens com fotos, não conformidades e assinaturas.
export const FvsRelatorio = forwardRef<HTMLElement, { fvs: Inspecao; fotos: FotoFvs[]; empresaNome: string }>(({ fvs: f, fotos, empresaNome }, ref) => {
  const [company, setCompany] = useState<Company | null>(null);
  useEffect(() => setCompany(loadCompany()), []);
  const locais = useFotosLocais(fotos);
  // avisa quando todas as fotos já viraram endereços locais (o PDF espera por isso)
  const prontas = fotos.every((x) => !x.url || locais[x.id]);
  const fotosDe = (respostaId: string) => fotos.filter((x) => x.respostaId === respostaId).map((x) => locais[x.id] || x.url).filter(Boolean);
  const c = contarRespostas(f.respostas);
  const conformes = f.respostas.filter((r) => r.resultado === "C").length;
  const na = f.respostas.filter((r) => r.resultado === "NA").length;
  const ncs = f.respostas.map((r, k) => ({ r, n: k + 1 })).filter(({ r }) => r.resultado === "NC");

  return (
    <article ref={ref} data-fotos-prontas={prontas ? "sim" : "nao"} className="delivery-report space-y-6 rounded-obra bg-card p-5 text-card-foreground sm:p-7">
      <CompanyHeader company={company ?? { name: empresaNome, logo: null, info: "" }} dataPdfBlock nameClass="text-lg font-bold" />
      <header className="report-head flex items-start justify-between gap-3" data-pdf-block>
        <div>
          <p className="text-sm">CheckObra · Ficha de Verificação de Serviço</p>
          <h1 className="text-2xl font-bold">
            {numeroFvs(f.numero)} — {f.modelo}
          </h1>
          <p className="mt-1 text-sm">{[f.obra, f.local].filter(Boolean).join(" · ")}</p>
        </div>
        <span className="rounded-full bg-card px-3 py-1 text-xs font-bold text-card-foreground">
          {f.status === "concluida" ? "Concluída" : "Em andamento (prévia)"}
        </span>
      </header>

      <section>
        <h2 className="report-section-title" data-pdf-block>Identificação</h2>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Empresa" valor={empresaNome || company?.name || ""} />
          <Campo rotulo="Empreendimento" valor={f.obra} />
          <Campo rotulo="Local" valor={f.local} />
          <Campo rotulo="Modelo" valor={`${f.modelo} (versão ${f.modeloVersao})`} />
          <Campo rotulo="Serviço" valor={f.modeloServico} />
          <Campo rotulo="Data" valor={f.concluidaEm ? `Concluída em ${data(f.concluidaEm)}` : `Iniciada em ${data(f.criadaEm)}`} />
          <Campo rotulo="Inspetor" valor={f.inspetorNome} />
          <Campo rotulo="Empreiteiro" valor={[f.empreiteiroNome, f.empreiteiroCnpj && `CNPJ ${formatarCnpj(f.empreiteiroCnpj)}`].filter(Boolean).join(" · ")} />
        </div>
      </section>

      <section data-pdf-block>
        <h2 className="report-section-title">Resumo</h2>
        <div className="grid grid-cols-4 gap-2 text-center text-sm">
          {[
            ["Itens", c.total],
            ["Conformes", conformes],
            ["Não conformes", c.nc],
            ["N/A", na],
          ].map(([r, v]) => (
            <div key={r} className="rounded-xl bg-obra-fundo p-2">
              <p className="text-xl font-extrabold">{v}</p>
              <p className="text-xs text-muted-foreground">{r}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="report-section-title" data-pdf-block>Itens verificados</h2>
        <ol className="space-y-3">
          {f.respostas.map((r, k) => {
            const fs = fotosDe(r.id);
            return (
              <li key={r.id} className={`rounded-xl border p-3 ${r.resultado === "NC" ? "border-obra-nc" : "border-obra-borda"}`}>
                <div className="flex items-start justify-between gap-3" data-pdf-block>
                  <div className="min-w-0">
                    <p className="font-bold">
                      {k + 1}. {r.texto}
                    </p>
                    {r.criterio && <p className="text-sm text-muted-foreground">Critério: {r.criterio}</p>}
                    {r.observacao && <p className="mt-1 text-sm">Observação: {r.observacao}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${r.resultado ? COR[r.resultado] : "bg-obra-fundo"}`}>
                    {r.resultado ? RESULTADO_ROTULO[r.resultado] : "Sem resposta"}
                  </span>
                </div>
                {fs.length > 0 && (
                  <div className="mt-2">
                    <ReportPhotos photos={fs} label={`Item ${k + 1} — foto`} />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <section>
        <h2 className="report-section-title" data-pdf-block>Não conformidades</h2>
        {ncs.length === 0 ? (
          <p className="text-sm" data-pdf-block>Nenhuma não conformidade registrada.</p>
        ) : (
          <ul className="space-y-2">
            {ncs.map(({ r, n }) => (
              <li key={r.id} className="rounded-xl bg-obra-nc-fundo p-3 text-sm" data-pdf-block>
                <p className="font-bold text-obra-nc">
                  Item {n}: {r.texto}
                </p>
                <p>{r.observacao || "Sem descrição"}</p>
                {f.empreiteiroNome && <p className="text-muted-foreground">Responsável pela correção: {f.empreiteiroNome}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {f.observacoes && (
        <section data-pdf-block>
          <h2 className="report-section-title">Observações gerais</h2>
          <p className="whitespace-pre-wrap text-sm">{f.observacoes}</p>
        </section>
      )}

      <section className="border-t border-border pb-3 pt-4" data-pdf-block>
        <h2 className="report-section-title">Assinaturas</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {(["inspetor", "empreiteiro"] as const).map((papel) => {
            const a = f.assinaturas.find((x) => x.papel === papel);
            const nome = a?.nome || (papel === "inspetor" ? f.inspetorNome : f.empreiteiroNome);
            return (
              <div key={papel}>
                {a?.imagem ? <img src={a.imagem} alt={`Assinatura — ${PAPEL_ASSINATURA[papel]}`} className="h-24 w-full object-contain" /> : <div className="h-24" />}
                <div className="border-t border-foreground pt-1 text-sm">{nome || " "}</div>
                <p className="text-xs text-muted-foreground">{PAPEL_ASSINATURA[papel]}</p>
              </div>
            );
          })}
        </div>
      </section>
    </article>
  );
});
FvsRelatorio.displayName = "FvsRelatorio";
