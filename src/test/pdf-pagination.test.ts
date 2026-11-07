import { describe, expect, it } from "vitest";
import { nextPdfPageEnd } from "@/lib/pdf-pagination";

describe("intact report evidence", () => {
  it("moves a photo to the next page even when it begins in the first half", () => {
    expect(nextPdfPageEnd(0, 1000, 2400, [{ top: 300, bottom: 1100 }])).toBe(300);
    expect(nextPdfPageEnd(300, 1000, 2400, [{ top: 300, bottom: 1100 }])).toBe(1300);
  });
  it("keeps the signature and signer's name together", () => {
    expect(nextPdfPageEnd(1000, 1000, 2300, [
      { top: 1750, bottom: 1950 }, { top: 1720, bottom: 2050 },
    ])).toBe(1720);
  });
  it("rechecks overlapping blocks after moving the page boundary", () => {
    expect(nextPdfPageEnd(0, 1000, 2400, [
      { top: 800, bottom: 1100 }, { top: 600, bottom: 850 },
    ])).toBe(600);
  });
  it("progresses through oversized text without blank pages or an infinite loop", () => {
    expect(nextPdfPageEnd(0, 1000, 2400, [{ top: 0, bottom: 2200 }])).toBe(1000);
    expect(nextPdfPageEnd(2000, 1000, 2400, [])).toBe(2400);
  });
});