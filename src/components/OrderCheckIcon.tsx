import { Check, Minus, X } from "lucide-react";
import type { CheckResult } from "@/lib/orders";

export function OrderCheckIcon({ r }: { r: CheckResult }) {
  if (r === "C") return <Check className="h-5 w-5 text-success" strokeWidth={3} />;
  if (r === "P") return <X className="h-5 w-5 text-destructive" strokeWidth={3} />;
  return <Minus className="h-5 w-5 text-warning" strokeWidth={3} />;
}
