import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SignaturePad } from "@/components/SignaturePad";
import { OrderCheckIcon } from "@/components/OrderCheckIcon";
import { MapPin } from "lucide-react";
import { checkLabel, type CheckResult, compressImage, type ServiceOrder } from "@/lib/orders";
import { lerOS, salvarOS, type VinculoOS } from "@/lib/os-store";
import { listarLocais } from "@/lib/empreendimentos-store";
import { caminhoDoLocal, nomeDoCaminho, type Local } from "@/lib/empreendimentos";
import { SeletorLocal } from "@/components/SeletorLocal";
import { EscolherEmpreendimento, useEmpreendimentos } from "@/components/EmpreendimentoContext";

export const Route = createFileRoute("/os/nova")({
  validateSearch: (s: Record<string, unknown>): { id?: string } => (typeof s["id"] === "string" ? { id: s["id"] } : {}),
  head: () => ({
    meta: [
      { title: "Nova Ordem de Serviço" },
      { name: "description", content: "Preencha os dados do cliente, serviço, fotos e assinatura." },
      { property: "og:title", content: "Nova Ordem de Serviço" },
      { property: "og:description", content: "Crie uma nova OS de manutenção." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewOrder,
});

const empty = (): ServiceOrder => ({
  id: crypto.randomUUID(),
  number: 0,
  createdAt: new Date().toISOString(),
  status: "aberta",
  client: { name: "", phone: "", email: "", document: "", address: "" },
  equipment: "",
  problem: "",
  service: "",
  technician: "",
  value: "",
  photos: [],
  signature: null,
  signedBy: "",
  openerName: "",
  openerSignature: null,
  techSignature: null,
  checks: [],
});

function NewOrder() {
  const { id } = Route.useSearch();
  const nav = useNavigate();
  const { atual } = useEmpreendimentos();
  const [o, setO] = useState<ServiceOrder | null>(null);
  const [vinculo, setVinculo] = useState<VinculoOS | null>(null);
  const [locais, setLocais] = useState<Local[]>([]);
  const [escolhendoLocal, setEscolhendoLocal] = useState(false);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (id) {
      // editar: a OS já sabe o seu empreendimento e local
      lerOS(id)
        .then((r) => {
          if (!r) return setErro("OS não encontrada ou sem acesso.");
          setO(r.ordem);
          setVinculo(r.vinculo);
        })
        .catch(() => setErro("Não foi possível carregar a OS."));
    } else if (atual) {
      setO(empty());
      setVinculo({ empreendimentoId: atual.id, localId: null });
    }
  }, [id, atual]);
  useEffect(() => {
    if (vinculo?.empreendimentoId) listarLocais([vinculo.empreendimentoId]).then(setLocais).catch(() => setLocais([]));
  }, [vinculo?.empreendimentoId]);

  if (!id && !atual)
    return (
      <main className="mx-auto max-w-3xl px-4 pb-6 pt-5">
        <EscolherEmpreendimento titulo="Em qual empreendimento é a OS?" />
      </main>
    );
  if (erro && !o) return <main className="mx-auto max-w-3xl px-4 pb-6 pt-5"><p role="alert" className="obra-alerta-erro">{erro}</p></main>;
  if (!o || !vinculo) return <main className="p-8 text-center text-obra-suave" role="status">Carregando…</main>;
  const set = (patch: Partial<ServiceOrder>) => setO({ ...o, ...patch });
  const setC = (k: keyof ServiceOrder["client"], v: string) => setO({ ...o, client: { ...o.client, [k]: v } });

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    const imgs = await Promise.all(Array.from(files).map((f) => compressImage(f)));
    setO((cur) => (cur ? { ...cur, photos: [...cur.photos, ...imgs] } : cur));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      const salva = await salvarOS(o, vinculo);
      nav({ to: "/os/$id", params: { id: salva.id } });
    } catch {
      setErro("Não foi possível salvar a OS. Verifique a internet; se houver muitas fotos, remova algumas e tente de novo.");
      setSalvando(false);
    }
  };
  const caminhoLocal = vinculo.localId ? nomeDoCaminho(caminhoDoLocal(locais, vinculo.localId)) : "";

  return (
    <main className="mx-auto max-w-3xl px-4 pb-6 pt-5">
      <h1 className="mb-5 font-display text-3xl font-bold">
        {o.number ? <>OS <span className="text-obra-laranja-texto">#{String(o.number).padStart(4, "0")}</span></> : "Nova OS"}
      </h1>
      <form onSubmit={submit} className="space-y-5">
        <section className="panel space-y-3">
          <h2 className="eyebrow">Local (opcional)</h2>
          {escolhendoLocal ? (
            <>
              <SeletorLocal locais={locais} onEscolher={(l) => { setVinculo({ ...vinculo, localId: l.id }); setEscolhendoLocal(false); }} />
              <button type="button" className="btn-ghost w-full" onClick={() => setEscolhendoLocal(false)}>Cancelar</button>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <p className="flex min-w-0 flex-1 items-center gap-2 font-semibold">
                <MapPin className="h-4 w-4 shrink-0 text-obra-suave" aria-hidden />
                <span className="truncate">{caminhoLocal || "Empreendimento inteiro (sem local específico)"}</span>
              </p>
              <button type="button" className="btn-ghost" onClick={() => setEscolhendoLocal(true)}>{caminhoLocal ? "Trocar" : "Escolher local"}</button>
              {caminhoLocal && <button type="button" className="btn-ghost" onClick={() => setVinculo({ ...vinculo, localId: null })}>Tirar local</button>}
            </div>
          )}
        </section>
        <section className="panel space-y-3">
          <h2 className="eyebrow">Cliente</h2>
          <input required className="field" placeholder="Nome *" value={o.client.name} onChange={(e) => setC("name", e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="field" type="tel" placeholder="Telefone" value={o.client.phone} onChange={(e) => setC("phone", e.target.value)} />
            <input className="field" type="email" placeholder="E-mail" value={o.client.email} onChange={(e) => setC("email", e.target.value)} />
          </div>
          <input className="field" placeholder="CPF / CNPJ" value={o.client.document} onChange={(e) => setC("document", e.target.value)} />
          <input className="field" placeholder="Endereço" value={o.client.address} onChange={(e) => setC("address", e.target.value)} />
        </section>

        <section className="panel space-y-3">
          <h2 className="eyebrow">Serviço</h2>
          <input className="field" placeholder="Equipamento / local" value={o.equipment} onChange={(e) => set({ equipment: e.target.value })} />
          <textarea className="field min-h-24" placeholder="Problema relatado" value={o.problem} onChange={(e) => set({ problem: e.target.value })} />
          <textarea className="field min-h-24" placeholder="Serviço executado" value={o.service} onChange={(e) => set({ service: e.target.value })} />
          <div className="grid gap-3 sm:grid-cols-3">
            <input className="field" placeholder="Técnico" value={o.technician} onChange={(e) => set({ technician: e.target.value })} />
            <input className="field" inputMode="decimal" placeholder="Valor (R$)" value={o.value} onChange={(e) => set({ value: e.target.value })} />
            <select className="field" value={o.status} onChange={(e) => set({ status: e.target.value as ServiceOrder["status"] })}>
              <option value="aberta">Aberta</option>
              <option value="em_andamento">Em andamento</option>
              <option value="concluida">Fechada</option>
            </select>
          </div>
        </section>

        <section className="panel space-y-3">
          <h2 className="eyebrow">Checklist do serviço</h2>
          {(o.checks ?? []).map((it, k) => {
            const upd = (patch: Partial<typeof it>) => set({ checks: (o.checks ?? []).map((x, m) => (m === k ? { ...x, ...patch } : x)) });
            return (
              <div key={k} className="space-y-2 rounded-md border border-border p-3">
                <div className="flex gap-2">
                  <input className="field flex-1" placeholder={`Item ${k + 1}`} value={it.text} onChange={(e) => upd({ text: e.target.value })} />
                  <button type="button" className="btn-ghost" onClick={() => set({ checks: (o.checks ?? []).filter((_, m) => m !== k) })}>×</button>
                </div>
                <div className="flex gap-2">
                  {(["C", "A", "P"] as CheckResult[]).map((v) => (
                    <button type="button" key={v} onClick={() => upd({ result: it.result === v ? null : v })}
                      className={`btn-ghost flex-1 justify-center gap-1 ${it.result === v ? (v === "C" ? "border-success bg-success/15" : v === "P" ? "border-destructive bg-destructive/15" : "border-warning bg-warning/20") : ""}`}>
                      <OrderCheckIcon r={v} />{checkLabel[v]}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          <button type="button" className="btn-ghost w-full" onClick={() => set({ checks: [...(o.checks ?? []), { text: "", result: null }] })}>+ Adicionar item</button>
        </section>

        <section className="panel space-y-3">
          <h2 className="eyebrow">Fotos</h2>
          <div className="grid grid-cols-3 gap-2">
            {o.photos.map((p, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-md">
                <img src={p} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                <button type="button" onClick={() => set({ photos: o.photos.filter((_, j) => j !== i) })} className="absolute right-1 top-1 rounded-full bg-foreground/80 px-2 text-sm text-background">×</button>
              </div>
            ))}
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-border text-sm text-muted-foreground">
              <span className="text-2xl text-obra-laranja-texto">+</span>Adicionar
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
            </label>
          </div>
        </section>

        <section className="panel space-y-3">
          <h2 className="eyebrow">Assinaturas</h2>
          <p className="text-sm font-semibold">1. Cliente (recebimento)</p>
          <input className="field" placeholder="Nome do cliente / quem recebeu" value={o.signedBy} onChange={(e) => set({ signedBy: e.target.value })} />
          <SignaturePad value={o.signature} onChange={(signature) => setO((cur) => (cur ? { ...cur, signature } : cur))} />
          <p className="pt-2 text-sm font-semibold">2. Responsável pela abertura da OS</p>
          <input className="field" placeholder="Nome do responsável" value={o.openerName ?? ""} onChange={(e) => set({ openerName: e.target.value })} />
          <SignaturePad value={o.openerSignature ?? null} onChange={(openerSignature) => setO((cur) => (cur ? { ...cur, openerSignature } : cur))} />
          <p className="pt-2 text-sm font-semibold">3. Técnico responsável{o.technician ? ` — ${o.technician}` : ""}</p>
          <SignaturePad value={o.techSignature ?? null} onChange={(techSignature) => setO((cur) => (cur ? { ...cur, techSignature } : cur))} />
        </section>

        {erro && <p role="alert" className="obra-alerta-erro">{erro}</p>}
        <button type="submit" className="btn-primary w-full" disabled={salvando}>{salvando ? "Salvando…" : "Salvar ordem de serviço"}</button>
      </form>
    </main>
  );
}
