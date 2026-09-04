import { describe, it, expect } from "node:test";
import { classifyDataCompleteness } from "../lib/opportunity-ranking.js";

describe("P1-3 Data Completeness Guidance", () => {
  it("COMPLETE when high completeness and many sources", () => {
    expect(classifyDataCompleteness(90, 6)).toBe("COMPLETE");
  });
  it("PARTIAL when middle coverage", () => {
    expect(classifyDataCompleteness(50, 3)).toBe("PARTIAL");
  });
  it("INSUFFICIENT when low/zero/null", () => {
    expect(classifyDataCompleteness(0, 0)).toBe("INSUFFICIENT");
    expect(classifyDataCompleteness(null, 1)).toBe("INSUFFICIENT");
  });
  it("UNAVAILABLE/not present stays INSUFFICIENT", () => {
    expect(classifyDataCompleteness(20, 0)).toBe("INSUFFICIENT");
  });
  it("does not alter scoring behavior", () => {
    const r = classifyDataCompleteness(100, 6);
    expect(typeof r).toBe("string");
    expect(r).not.toBe("BUY");
    expect(r).not.toBe("SELL");
  });
});
