import { expect, test } from "vitest";
import { fvsTotal } from "@/lib/fvs";
test("200 m² x R$ 35,50 = 7100", () => expect(fvsTotal({ quantity: "200", unitPrice: "35,50" })).toBe(7100));
test("1.250,5 x 10 = 12505", () => expect(fvsTotal({ quantity: "1.250,5", unitPrice: "10" })).toBe(12505));
