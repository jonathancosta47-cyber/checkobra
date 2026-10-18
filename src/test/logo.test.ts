import { describe, expect, it } from "vitest";
import { fitLogo } from "@/components/CompanyLogo";
describe("fitLogo", () => {
  it("keeps aspect ratio for wide logos", () => expect(fitLogo(1000, 200)).toEqual({ width: 180, height: 36 }));
  it("keeps aspect ratio for tall logos", () => expect(fitLogo(200, 400)).toEqual({ width: 36, height: 72 }));
});
