import { describe, expect, it } from "vitest";
import { fitLogo } from "@/components/CompanyLogo";
import { companyLogos } from "@/components/CompanyHeader";

describe("fitLogo", () => {
  it("keeps aspect ratio for wide logos", () => expect(fitLogo(1000, 200)).toEqual({ width: 180, height: 36 }));
  it("keeps aspect ratio for tall logos", () => expect(fitLogo(200, 400)).toEqual({ width: 36, height: 72 }));
  it("keeps aspect ratio inside the smaller box used for three logos", () =>
    expect(fitLogo(1000, 200, 120, 52)).toEqual({ width: 120, height: 24 }));
});

describe("companyLogos", () => {
  it("returns up to three logos in order", () =>
    expect(companyLogos({ name: "", logo: "a", logo2: "b", logo3: "c", info: "" })).toEqual(["a", "b", "c"]));
  it("skips logos the user did not upload", () => {
    expect(companyLogos({ name: "", logo: null, logo2: "b", logo3: "c", info: "" })).toEqual(["b", "c"]);
    expect(companyLogos({ name: "", logo: "a", logo2: null, logo3: "c", info: "" })).toEqual(["a", "c"]);
    expect(companyLogos({ name: "", logo: null, info: "" })).toEqual([]);
  });
});
