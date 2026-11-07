import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Trash2, Copy, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignaturePad } from "@/components/SignaturePad";
import { DeliveryPhotos } from "./DeliveryPhotos";
import { DeliveryEvaluation } from "./DeliveryEvaluation";
import { unitLabels } from "./DeliveryReport";
import { saveDelivery } from "@/lib/delivery-store";
import {
  documentLabels,
  evaluationLabels,
  finalResults,
  issueStatuses,
  issuesOf,
  newItem,
  pendingCount,
  summaryText,
  validateDelivery,
  type Delivery,
  type DeliveryItem,
  type Evaluation,
} from "@/lib/delivery";
export function DeliveryForm({ initial }: { initial: Delivery }) {
  const [d, setD] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [filter, setFilter] = useState("all"),
    [copied, setCopied] = useState(false);
  const nav = useNavigate();
  const patchItem = (rid: string, id: string, p: Partial<DeliveryItem>) =>
    setD((c) => ({
      ...c,
      rooms: c.rooms.map((r) =>
        r.id === rid
          ? { ...r, items: r.items.map((it) => (it.id === id ? { ...it, ...p } : it)) }
          : r,
      ),
    }));
  const total = d.rooms.reduce((n, r) => n + r.items.length, 0),
    evaluated = d.rooms.reduce((n, r) => n + r.items.filter((i) => i.result !== null).length, 0);
  return (
    <form
      className="space-y-7"
      onSubmit={async (e) => {
        e.preventDefault();
        const invalid = validateDelivery(d);
        if (invalid) {
          setError(invalid);
          return;
        }
        setBusy(true);
        setError("");
        try {
          await saveDelivery(d);
          await nav({ to: "/entregas/$id", params: { id: d.id } });
        } catch {
          setError("Não foi possível salvar a vistoria. Confira sua conexão e tente novamente.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <section className="space-y-3">
        <h2 className="report-section-title">Identificação da unidade</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(unitLabels).map(([key, label]) => (
            <label key={key} className="text-sm">
              {label}
              <input
                className="field mt-1"
                required={key === "development" || key === "apartment"}
                type={key === "date" ? "date" : "text"}
                inputMode={key === "area" ? "decimal" : undefined}
                value={d.unit[key as keyof Delivery["unit"]]}
                onChange={(e) => setD({ ...d, unit: { ...d.unit, [key]: e.target.value } })}
              />
            </label>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold">Checklist por ambiente</h2>
          <span className="text-sm text-muted-foreground">
            {evaluated}/{total} avaliados · {pendingCount(d)} pendências
          </span>
        </div>
        <label className="block text-sm">
          Exibir itens
          <select className="field mt-1" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Todos</option>
            <option value="NC">Não conformes</option>
            <option value="PT">Pendentes de teste</option>
            <option value="empty">Não avaliados</option>
          </select>
        </label>
        {d.rooms.map((room, ri) => (
          <details key={room.id} open={ri === 0} className="border-b border-border pb-3">
            <summary className="cursor-pointer py-3 font-bold text-primary">
              {room.name}{" "}
              <span className="font-normal text-muted-foreground">
                ({room.items.filter((i) => i.result !== null).length}/{room.items.length})
              </span>
            </summary>
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  aria-label="Nome do ambiente"
                  className="field"
                  value={room.name}
                  onChange={(e) =>
                    setD({
                      ...d,
                      rooms: d.rooms.map((r) =>
                        r.id === room.id ? { ...r, name: e.target.value } : r,
                      ),
                    })
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={`Remover ambiente ${room.name}`}
                  onClick={() => {
                    if (confirm("Remover este ambiente e seus itens?"))
                      setD({ ...d, rooms: d.rooms.filter((r) => r.id !== room.id) });
                  }}
                >
                  <Trash2 />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Duplicar ambiente"
                  aria-label={`Duplicar ambiente ${room.name}`}
                  onClick={() =>
                    setD({
                      ...d,
                      rooms: [
                        ...d.rooms,
                        {
                          id: crypto.randomUUID(),
                          name: room.name + " 2",
                          items: room.items.map((i) => ({
                            ...newItem(i.text),
                            criteria: i.criteria,
                          })),
                        },
                      ],
                    })
                  }
                >
                  <Copy />
                </Button>
              </div>
              {room.items
                .filter(
                  (i) =>
                    filter === "all" ||
                    (filter === "empty" ? i.result === null : i.result === filter),
                )
                .map((item) => (
                  <div key={item.id} className="space-y-2 border-b border-border pb-4">
                    <div className="flex gap-2">
                      <input
                        aria-label="Item de inspeção"
                        className="field font-medium"
                        value={item.text}
                        required
                        onChange={(e) => patchItem(room.id, item.id, { text: e.target.value })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remover item ${item.text}`}
                        onClick={() => {
                          if (confirm("Remover este item?"))
                            setD({
                              ...d,
                              rooms: d.rooms.map((r) =>
                                r.id === room.id
                                  ? { ...r, items: r.items.filter((i) => i.id !== item.id) }
                                  : r,
                              ),
                            });
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    <input
                      aria-label="Critério / tolerância"
                      className="field text-sm"
                      placeholder="Critério / tolerância"
                      value={item.criteria}
                      onChange={(e) => patchItem(room.id, item.id, { criteria: e.target.value })}
                    />
                    <div className="grid grid-cols-4 gap-1">
                      {(Object.keys(evaluationLabels) as Exclude<Evaluation, null>[]).map((v) => (
                        <Button
                          key={v}
                          type="button"
                          variant="outline"
                          className={item.result === v ? "border-primary bg-primary/10" : ""}
                          aria-label={evaluationLabels[v]}
                          aria-pressed={item.result === v}
                          title={evaluationLabels[v]}
                          onClick={() =>
                            patchItem(room.id, item.id, { result: item.result === v ? null : v })
                          }
                        >
                          <DeliveryEvaluation value={v} label={false} />
                        </Button>
                      ))}
                    </div>
                    {item.result === "NC" && (
                      <fieldset className="space-y-3 border-l-2 border-destructive pl-3">
                        <legend className="mb-2 text-sm font-bold text-destructive">
                          Não conformidade
                        </legend>
                        <label className="block text-sm">
                          Descrição *
                          <textarea
                            className="field mt-1"
                            required
                            value={item.description}
                            onChange={(e) =>
                              patchItem(room.id, item.id, { description: e.target.value })
                            }
                          />
                        </label>
                        <label className="block text-sm">
                          Localização *
                          <input
                            className="field mt-1"
                            required
                            value={item.location}
                            onChange={(e) =>
                              patchItem(room.id, item.id, { location: e.target.value })
                            }
                          />
                        </label>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="text-sm">
                            Responsável pela correção *
                            <input
                              className="field mt-1"
                              required
                              value={item.owner}
                              onChange={(e) =>
                                patchItem(room.id, item.id, { owner: e.target.value })
                              }
                            />
                          </label>
                          <label className="text-sm">
                            Prazo de correção *
                            <input
                              className="field mt-1"
                              type="date"
                              required
                              value={item.deadline}
                              onChange={(e) =>
                                patchItem(room.id, item.id, { deadline: e.target.value })
                              }
                            />
                          </label>
                          <label className="text-sm">
                            Status
                            <select
                              className="field mt-1"
                              value={item.status}
                              onChange={(e) =>
                                patchItem(room.id, item.id, {
                                  status: e.target.value as DeliveryItem["status"],
                                })
                              }
                            >
                              {issueStatuses.map((s) => (
                                <option key={s}>{s}</option>
                              ))}
                            </select>
                          </label>
                          <label className="text-sm">
                            Classificação
                            <input
                              className="field mt-1"
                              placeholder="Classificação da não conformidade"
                              value={item.severity}
                              onChange={(e) =>
                                patchItem(room.id, item.id, { severity: e.target.value })
                              }
                            />
                          </label>
                        </div>
                        <DeliveryPhotos
                          label="Foto da não conformidade *"
                          value={item.photos}
                          onChange={(photos) => patchItem(room.id, item.id, { photos })}
                        />
                      </fieldset>
                    )}
                  </div>
                ))}
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setD({
                    ...d,
                    rooms: d.rooms.map((r) =>
                      r.id === room.id ? { ...r, items: [...r.items, newItem()] } : r,
                    ),
                  })
                }
              >
                <Plus />
                Item
              </Button>
            </div>
          </details>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setD({
              ...d,
              rooms: [
                ...d.rooms,
                { id: crypto.randomUUID(), name: "Novo ambiente", items: [newItem()] },
              ],
            })
          }
        >
          <Plus />
          Ambiente
        </Button>
      </section>
      <section>
        <h2 className="report-section-title">Controle de não conformidades</h2>
        {issuesOf(d).length ? (
          issuesOf(d).map(({ room, item }, i) => (
            <div key={item.id} className="border-b border-border py-2 text-sm">
              <p className="font-semibold">
                {i + 1}. {room} · {item.description || item.text}
              </p>
              <p>
                {item.owner || "Responsável não informado"} · {item.deadline || "Sem prazo"} ·{" "}
                {item.status}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma não conformidade registrada.</p>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="report-section-title">Documentação para entrega</h2>
        {documentLabels.map((text, i) => (
          <label key={text} className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-primary"
              checked={!!d.documents[i]}
              onChange={(e) =>
                setD({
                  ...d,
                  documents: d.documents.map((v, j) => (j === i ? e.target.checked : v)),
                })
              }
            />
            {text}
          </label>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="report-section-title">Resultado da vistoria</h2>
        <label className="block text-sm">
          Classificação final
          <select
            className="field mt-1"
            value={d.result}
            onChange={(e) => setD({ ...d, result: e.target.value })}
          >
            <option value="">Não definido</option>
            {finalResults.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <p className="font-bold">Quantidade de pendências: {pendingCount(d)}</p>
        <label className="block text-sm">
          Observações gerais
          <textarea
            className="field mt-1 min-h-24"
            value={d.observations}
            onChange={(e) => setD({ ...d, observations: e.target.value })}
          />
        </label>
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(summaryText(d));
              setCopied(true);
            } catch {
              setError("Não foi possível copiar o resultado.");
            }
          }}
        >
          <Copy />
          {copied ? "Resultado copiado" : "Copiar resultado"}
        </Button>
        <DeliveryPhotos
          label="Registro fotográfico final"
          value={d.photos}
          onChange={(photos) => setD({ ...d, photos })}
        />
      </section>
      <section className="space-y-5">
        <h2 className="report-section-title">Assinaturas</h2>
        {d.signatures.map((s, i) => (
          <div key={s.role} className="space-y-2">
            <label className="block text-sm">
              {s.role}
              <input
                className="field mt-1"
                placeholder="Nome de quem assina"
                value={s.name}
                onChange={(e) =>
                  setD({
                    ...d,
                    signatures: d.signatures.map((x, j) =>
                      i === j ? { ...x, name: e.target.value } : x,
                    ),
                  })
                }
              />
            </label>
            <SignaturePad
              value={s.image}
              onChange={(image) =>
                setD((c) => ({
                  ...c,
                  signatures: c.signatures.map((x, j) => (i === j ? { ...x, image } : x)),
                }))
              }
            />
          </div>
        ))}
      </section>
      {error && (
        <p
          role="alert"
          className="sticky bottom-20 border border-destructive bg-card p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <Button size="lg" className="w-full" disabled={busy}>
        <Save />
        {busy ? "Salvando…" : "Salvar vistoria"}
      </Button>
    </form>
  );
}
