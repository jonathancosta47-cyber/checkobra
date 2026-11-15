import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, Camera, Minus, Plus, Trash2 } from "lucide-react";
import { criarEmpreendimento, enviarFoto } from "@/lib/empreendimentos-store";
import { previaEstrutura, validarEstrutura } from "@/lib/empreendimentos";
import { gerencia } from "@/lib/fvs-db";
import { Pagina } from "@/components/modulos";
import { usePerfil } from "@/components/PerfilContext";
import { useEmpreendimentos } from "@/components/EmpreendimentoContext";

export const Route = createFileRoute("/empreendimentos/novo")({
  head: () => ({
    meta: [
      { title: "Novo empreendimento — CheckObra" },
      { name: "description", content: "Cadastre o empreendimento e gere torres, pavimentos e unidades automaticamente." },
    ],
  }),
  component: Assistente,
});

const AREAS_PADRAO = ["Portaria", "Salão de festas", "Piscina"];

function Contador({ rotulo, valor, onChange, min, max }: { rotulo: string; valor: number; onChange: (v: number) => void; min: number; max: number }) {
  const ajustar = (v: number) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <div>
      <span className="obra-label">{rotulo}</span>
      <div className="flex items-center gap-2">
        <button type="button" className="obra-btn-claro w-14 shrink-0 px-0" onClick={() => ajustar(valor - 1)} disabled={valor <= min} aria-label={`Diminuir ${rotulo.toLowerCase()}`}>
          <Minus className="h-5 w-5" aria-hidden />
        </button>
        <input
          className="obra-input text-center text-lg font-extrabold"
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={Number.isNaN(valor) ? "" : valor}
          onChange={(e) => onChange(e.target.value === "" ? NaN : Math.trunc(Number(e.target.value)))}
          onBlur={() => ajustar(Number.isNaN(valor) ? min : valor)}
          aria-label={rotulo}
        />
        <button type="button" className="obra-btn-claro w-14 shrink-0 px-0" onClick={() => ajustar((Number.isNaN(valor) ? min : valor) + 1)} disabled={valor >= max} aria-label={`Aumentar ${rotulo.toLowerCase()}`}>
          <Plus className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function Assistente() {
  const perfil = usePerfil();
  const { recarregar, escolher } = useEmpreendimentos();
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [previaFoto, setPreviaFoto] = useState("");
  const [torres, setTorres] = useState(1);
  const [pavimentos, setPavimentos] = useState(4);
  const [unidades, setUnidades] = useState(4);
  const [areas, setAreas] = useState<string[]>(AREAS_PADRAO);
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);

  if (!gerencia(perfil.papel)) {
    return (
      <Pagina className="pt-5">
        <p className="obra-card p-5 text-center text-obra-suave">Só o admin ou um engenheiro da empresa cria empreendimentos.</p>
      </Pagina>
    );
  }

  const previa = previaEstrutura({ torres: torres || 0, pavimentos: pavimentos || 0, unidades: unidades || 0 });
  const areasValidas = areas.map((a) => a.trim()).filter(Boolean);

  return (
    <Pagina className="pt-5">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const invalido = validarEstrutura({ nome, torres, pavimentos, unidades });
          if (invalido) return setErro(invalido);
          setBusy(true);
          setErro("");
          try {
            const id = await criarEmpreendimento({ nome, endereco, torres, pavimentos, unidades, areasComuns: areasValidas });
            if (foto) {
              // se a foto falhar, o empreendimento já está criado: dá para enviar a foto depois
              await enviarFoto(perfil.empresaId, id, foto).catch(() => undefined);
            }
            await recarregar();
            escolher(id);
            navigate({ to: "/empreendimentos/$id", params: { id }, replace: true });
          } catch {
            setErro("Não foi possível criar o empreendimento. Verifique a internet e tente de novo.");
            setBusy(false);
          }
        }}
      >
        <section className="obra-card space-y-4 p-4">
          <h2 className="text-lg font-extrabold text-obra-grafite">Dados do empreendimento</h2>
          <label className="block">
            <span className="obra-label">Nome *</span>
            <input className="obra-input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Residencial Bela Vista" />
          </label>
          <label className="block">
            <span className="obra-label">Endereço</span>
            <input className="obra-input" value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, cidade" autoComplete="street-address" />
          </label>
          <div>
            <span className="obra-label">Foto (opcional)</span>
            <label className="flex min-h-14 cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border border-dashed border-obra-borda-campo bg-obra-fundo p-2">
              {previaFoto ? (
                <img src={previaFoto} alt="Prévia da foto" className="h-16 w-24 rounded-xl object-cover" />
              ) : (
                <span className="flex h-16 w-24 items-center justify-center rounded-xl bg-obra-bege">
                  <Camera className="h-6 w-6 text-obra-grafite" aria-hidden />
                </span>
              )}
              <span className="text-sm font-bold text-obra-grafite">{foto ? "Trocar foto" : "Tirar ou escolher foto"}</span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFoto(f);
                  setPreviaFoto(f ? URL.createObjectURL(f) : "");
                }}
              />
            </label>
          </div>
        </section>

        <section className="obra-card space-y-4 p-4">
          <h2 className="text-lg font-extrabold text-obra-grafite">Estrutura</h2>
          <Contador rotulo="Torres" valor={torres} onChange={setTorres} min={0} max={26} />
          <Contador rotulo="Pavimentos por torre" valor={pavimentos} onChange={setPavimentos} min={1} max={200} />
          <Contador rotulo="Unidades por pavimento" valor={unidades} onChange={setUnidades} min={1} max={99} />
          <div className="rounded-2xl bg-obra-bege p-4 text-sm text-obra-grafite" aria-live="polite">
            <p className="font-extrabold">Vai ser criado:</p>
            <p>
              {previa.torres} {previa.torres === 1 ? "torre" : "torres"}
              {previa.torres > 0 && ` (${previa.nomesTorres.length > 3 ? `${previa.nomesTorres.slice(0, 3).join(", ")}…` : previa.nomesTorres.join(", ")})`}
              {" · "}
              {previa.pavimentos} pavimentos · {previa.unidades} unidades
            </p>
            {previa.unidades > 0 && (
              <p className="mt-1">
                Numeração por torre: <strong>{previa.primeiraUnidade}</strong> a <strong>{previa.ultimaUnidade}</strong>
              </p>
            )}
            {areasValidas.length > 0 && <p className="mt-1">+ {areasValidas.length} {areasValidas.length === 1 ? "área comum" : "áreas comuns"}</p>}
          </div>
        </section>

        <section className="obra-card space-y-3 p-4">
          <h2 className="text-lg font-extrabold text-obra-grafite">Áreas comuns</h2>
          <ul className="space-y-2">
            {areas.map((a, k) => (
              <li key={k} className="flex gap-2">
                <input
                  className="obra-input"
                  value={a}
                  aria-label={`Área comum ${k + 1}`}
                  onChange={(e) => setAreas(areas.map((x, j) => (j === k ? e.target.value : x)))}
                />
                <button type="button" className="obra-btn-claro w-14 shrink-0 px-0" aria-label={`Remover ${a || "área comum"}`} onClick={() => setAreas(areas.filter((_, j) => j !== k))}>
                  <Trash2 className="h-5 w-5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="obra-btn-claro w-full" onClick={() => setAreas([...areas, ""])}>
            <Plus className="h-5 w-5" aria-hidden /> Adicionar área comum
          </button>
          <p className="text-xs text-obra-suave">Depois dá para ajustar tudo na tela Estrutura.</p>
        </section>

        {erro && <p role="alert" className="obra-alerta-erro">{erro}</p>}
        <button type="submit" className="obra-btn w-full" disabled={busy}>
          <Building2 className="h-5 w-5" aria-hidden /> {busy ? "Criando…" : "Criar empreendimento"}
        </button>
      </form>
    </Pagina>
  );
}
