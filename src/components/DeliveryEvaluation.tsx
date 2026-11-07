import { Check, X, Minus, Clock } from "lucide-react";
import { evaluationLabels, type Evaluation } from "@/lib/delivery";
export function DeliveryEvaluation({
  value,
  label = true,
}: {
  value: Evaluation;
  label?: boolean;
}) {
  const icons = { C: Check, NC: X, NA: Minus, PT: Clock };
  if (!value) return <span>Não avaliado</span>;
  const Icon = icons[value];
  return (
    <span
      className={`inline-flex items-center gap-1 ${value === "C" ? "text-success" : value === "NC" ? "text-destructive" : value === "NA" ? "text-warning" : "text-info"}`}
    >
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={3} />
      {label ? evaluationLabels[value] : value === "NA" ? "N/A" : value}
    </span>
  );
}
