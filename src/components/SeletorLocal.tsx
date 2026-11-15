import { useState } from "react";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { caminhoDoLocal, filhosDe, nomeDoCaminho, TIPO_ROTULO, type Local, type TipoLocal } from "@/lib/empreendimentos";

const ARTIGO_INTEIRO: Partial<Record<TipoLocal, string>> = { torre: "a torre inteira", pavimento: "o pavimento inteiro" };

// Escolha de local navegando na estrutura (torre › pavimento › unidade, e áreas comuns).
// "aceita" diz quais tipos podem ser escolhidos (ex.: vistoria de entrega só aceita unidade).
export function SeletorLocal({
  locais,
  onEscolher,
  aceita = ["torre", "pavimento", "unidade", "area_comum"],
}: {
  locais: Local[];
  onEscolher: (l: Local) => void;
  aceita?: TipoLocal[];
}) {
  const [paiId, setPaiId] = useState<string | null>(null);
  const pai = paiId ? locais.find((l) => l.id === paiId) : undefined;
  const nivel = filhosDe(locais, paiId);
  const caminho = paiId ? caminhoDoLocal(locais, paiId) : [];

  return (
    <div className="space-y-3">
      {pai && (
        <div className="obra-card flex items-center gap-3 p-3">
          <button type="button" onClick={() => setPaiId(pai.pai_id)} className="obra-icone-btn bg-obra-bege" aria-label="Voltar um nível">
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <p className="min-w-0 truncate text-sm font-bold text-obra-grafite">{nomeDoCaminho(caminho)}</p>
        </div>
      )}
      {pai && aceita.includes(pai.tipo) && ARTIGO_INTEIRO[pai.tipo] && (
        <button type="button" className="obra-btn-claro w-full justify-start border-obra-laranja" onClick={() => onEscolher(pai)}>
          <MapPin className="h-5 w-5" aria-hidden /> Escolher {ARTIGO_INTEIRO[pai.tipo]}: {pai.nome}
        </button>
      )}
      {nivel.length === 0 ? (
        <p className="obra-card p-5 text-sm text-obra-suave">
          {pai ? "Nada cadastrado aqui." : "Este empreendimento ainda não tem estrutura. Cadastre na tela Estrutura."}
        </p>
      ) : (
        <ul className={pai?.tipo === "pavimento" ? "grid grid-cols-2 gap-3 sm:grid-cols-3" : "space-y-3"}>
          {nivel.map((l) => {
            const filhos = filhosDe(locais, l.id);
            const podeEntrar = filhos.length > 0;
            const podeEscolher = aceita.includes(l.tipo);
            if (!podeEntrar && !podeEscolher) return null;
            return (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => (podeEntrar ? setPaiId(l.id) : onEscolher(l))}
                  className="obra-card flex min-h-16 w-full items-center gap-3 p-4 text-left transition active:scale-[0.99]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-extrabold text-obra-grafite">{l.nome}</span>
                    <span className="block truncate text-sm text-obra-suave">
                      {podeEntrar ? `${filhos.length} ${filhos.length === 1 ? "item" : "itens"}` : TIPO_ROTULO[l.tipo]}
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-obra-suave" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
