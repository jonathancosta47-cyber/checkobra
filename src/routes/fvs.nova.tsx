import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, Check, ChevronLeft, ChevronRight, ClipboardList, MapPin } from "lucide-react";
import { criarInspecao, listarLocais, listarModelos, listarObras } from "@/lib/fvs-store";
import { caminhoDoLocal, filhosDe, nomeDoCaminho, PROXIMO_TIPO, TIPO_ROTULO, type Local, type Modelo, type Obra } from "@/lib/fvs-db";
import { Pagina } from "@/components/modulos";
import { PerfilGate } from "@/components/PerfilGate";

export const Route = createFileRoute("/fvs/nova")({
  head: () => ({
    meta: [
      { title: "Nova FVS — CheckObra" },
      { name: "description", content: "Escolha a obra, o local e o modelo da ficha de verificação." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <Pagina className="pt-5">
      <PerfilGate>
        <NovaFvs />
      </PerfilGate>
    </Pagina>
  );
}

type Passo = "obra" | "local" | "modelo";
const PASSOS: { p: Passo; l: string }[] = [
  { p: "obra", l: "Obra" },
  { p: "local", l: "Local" },
  { p: "modelo", l: "Modelo" },
];

function NovaFvs() {
  const navigate = useNavigate();
  const [obras, setObras] = useState<Obra[] | null>(null);
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [locais, setLocais] = useState<Local[]>([]);
  const [erro, setErro] = useState("");
  const [obra, setObra] = useState<Obra | null>(null);
  const [paiId, setPaiId] = useState<string | null>(null); // nível sendo mostrado
  const [local, setLocal] = useState<Local | null>(null);
  const [criando, setCriando] = useState(false);
  const passo: Passo = !obra ? "obra" : !local ? "local" : "modelo";

  useEffect(() => {
    Promise.all([listarObras(), listarModelos()])
      .then(([o, m]) => {
        setObras(o.filter((x) => x.status === "ativa"));
        setModelos(m.filter((x) => x.ativo && x.itens.length));
      })
      .catch(() => setErro("Não foi possível carregar obras e modelos."));
  }, []);

  const escolherObra = async (o: Obra) => {
    setErro("");
    try {
      setLocais(await listarLocais([o.id]));
      setObra(o);
      setPaiId(null);
    } catch {
      setErro("Não foi possível carregar os locais desta obra.");
    }
  };

  const voltar = () => {
    if (local) return setLocal(null);
    if (paiId) return setPaiId(locais.find((l) => l.id === paiId)?.pai_id ?? null);
    setObra(null);
  };

  const comecar = async (m: Modelo) => {
    if (!obra || !local) return;
    setCriando(true);
    setErro("");
    try {
      const id = await criarInspecao(obra.id, local.id, m);
      navigate({ to: "/fvs/$id", params: { id }, replace: true });
    } catch {
      setErro("Não foi possível criar a FVS. Tente de novo.");
      setCriando(false);
    }
  };

  const caminhoAtual = paiId ? caminhoDoLocal(locais, paiId) : [];
  const nivel = filhosDe(locais, paiId);
  const pai = paiId ? locais.find((l) => l.id === paiId) : undefined;

  return (
    <div className="space-y-4">
      {/* passos */}
      <ol className="grid grid-cols-3 gap-2" aria-label="Passos">
        {PASSOS.map(({ p, l }, k) => {
          const feito = PASSOS.findIndex((x) => x.p === passo) > k;
          const atual = p === passo;
          return (
            <li key={p} aria-current={atual ? "step" : undefined} className={`flex items-center justify-center gap-1.5 rounded-full py-2 text-sm font-bold ${atual ? "bg-obra-laranja text-obra-grafite" : feito ? "bg-obra-bege text-obra-grafite" : "bg-obra-card text-obra-suave"}`}>
              {feito ? <Check className="h-4 w-4" aria-hidden /> : <span aria-hidden>{k + 1}.</span>} {l}
            </li>
          );
        })}
      </ol>

      {/* resumo do que já foi escolhido */}
      {obra && (
        <div className="obra-card flex items-center gap-3 p-3">
          <button type="button" onClick={voltar} className="obra-icone-btn bg-obra-bege" aria-label="Voltar um passo">
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <div className="min-w-0 text-sm">
            <p className="truncate font-extrabold text-obra-grafite">{obra.nome}</p>
            <p className="truncate text-obra-suave">{local ? nomeDoCaminho(caminhoDoLocal(locais, local.id)) : nomeDoCaminho(caminhoAtual) || "Escolha o local"}</p>
          </div>
        </div>
      )}

      {erro && <p role="alert" className="obra-alerta-erro">{erro}</p>}

      {passo === "obra" && (
        <section aria-label="Escolha a obra">
          <h2 className="mb-3 text-lg font-extrabold text-obra-grafite">Em qual obra?</h2>
          {obras === null ? (
            <p role="status" className="text-obra-suave">Carregando…</p>
          ) : obras.length === 0 ? (
            <p className="obra-card p-5 text-sm text-obra-suave">Nenhuma obra ativa cadastrada na sua empresa. Peça a um admin ou engenheiro para cadastrar.</p>
          ) : (
            <ul className="space-y-3">
              {obras.map((o) => (
                <li key={o.id}>
                  <Opcao icone={<Building2 className="h-6 w-6" aria-hidden />} titulo={o.nome} detalhe={o.endereco} onClick={() => escolherObra(o)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {passo === "local" && (
        <section aria-label="Escolha o local">
          <h2 className="mb-3 text-lg font-extrabold text-obra-grafite">
            {pai ? `${pai.nome}: escolha ${PROXIMO_TIPO[pai.tipo] === "unidade" ? "a unidade" : "o pavimento"}` : "Escolha a torre"}
          </h2>
          {pai && (
            <button type="button" className="obra-btn-claro mb-3 w-full justify-start border-obra-laranja" onClick={() => setLocal(pai)}>
              <MapPin className="h-5 w-5" aria-hidden /> Inspecionar {pai.tipo === "torre" ? "a torre inteira" : "o pavimento inteiro"}: {pai.nome}
            </button>
          )}
          {nivel.length === 0 ? (
            <p className="obra-card p-5 text-sm text-obra-suave">Nenhum local cadastrado aqui.</p>
          ) : (
            <ul className={pai?.tipo === "pavimento" ? "grid grid-cols-2 gap-3 sm:grid-cols-3" : "space-y-3"}>
              {nivel.map((l) => {
                const temFilhos = filhosDe(locais, l.id).length > 0;
                return (
                  <li key={l.id}>
                    <Opcao
                      titulo={l.nome}
                      detalhe={temFilhos ? `${filhosDe(locais, l.id).length} ${PROXIMO_TIPO[l.tipo] === "unidade" ? "unidades" : "pavimentos"}` : TIPO_ROTULO[l.tipo]}
                      onClick={() => (temFilhos ? setPaiId(l.id) : setLocal(l))}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {passo === "modelo" && (
        <section aria-label="Escolha o modelo">
          <h2 className="mb-3 text-lg font-extrabold text-obra-grafite">Qual serviço vai verificar?</h2>
          {modelos.length === 0 ? (
            <p className="obra-card p-5 text-sm text-obra-suave">Nenhum modelo de FVS ativo na sua empresa.</p>
          ) : (
            <ul className="space-y-3">
              {modelos.map((m) => (
                <li key={m.id}>
                  <Opcao
                    icone={<ClipboardList className="h-6 w-6" aria-hidden />}
                    titulo={m.nome}
                    detalhe={`${m.itens.length} itens a verificar`}
                    onClick={() => comecar(m)}
                    desabilitado={criando}
                  />
                </li>
              ))}
            </ul>
          )}
          {criando && <p role="status" className="mt-3 text-center text-obra-suave">Criando a FVS…</p>}
        </section>
      )}
    </div>
  );
}

function Opcao({ titulo, detalhe, onClick, icone, desabilitado }: { titulo: string; detalhe?: string; onClick: () => void; icone?: React.ReactNode; desabilitado?: boolean }) {
  return (
    <button
      type="button"
      disabled={desabilitado}
      onClick={onClick}
      className="obra-card flex min-h-16 w-full items-center gap-3 p-4 text-left transition active:scale-[0.99] disabled:opacity-60"
    >
      {icone && <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-obra-bege text-obra-grafite">{icone}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-extrabold text-obra-grafite">{titulo}</span>
        {detalhe && <span className="block truncate text-sm text-obra-suave">{detalhe}</span>}
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-obra-suave" aria-hidden />
    </button>
  );
}
