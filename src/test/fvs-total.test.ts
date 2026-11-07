import { expect, test } from "vitest";
import { fvsTotal } from "@/lib/fvs";
test("200 m² x R$ 35,50 = 7100", () => expect(fvsTotal({ quantity: "200", unitPrice: "35,50" })).toBe(7100));
test("1.250,5 x 10 = 12505", () => expect(fvsTotal({ quantity: "1.250,5", unitPrice: "10" })).toBe(12505));
import { findContract } from "@/lib/fvs";
test("contrato: empreiteiro faz alvenaria a R$ 30/m²", () => {
  const list = [{ id: "1", name: "João Obras", contracts: [{ service: "Alvenaria de vedação", unit: "m²", unitPrice: "30" }] }];
  expect(findContract(list, " joão obras", "Alvenaria de vedação")?.unitPrice).toBe("30");
  expect(findContract(list, "Outro", "Alvenaria de vedação")).toBeUndefined();
});
