import { describe, it, expect } from "node:test";
import { defaultOpportunityRanking } from "../lib/opportunity-ranking.js";

describe("Penny Intelligence Manager", () => {
  it("should extract penny score from b1.pennyScore", () => {
    const b1 = { pennyScore: 12 };
    const result = defaultOpportunityRanking("AAPL", { pennyIntelligence: b1 });
    expect(result.opportunityScore).toBe(12);
  });

  it("should extract penny score from b1.setupScore when pennyScore is null", () => {
    const b1 = { setupScore: 8 };
    const result = defaultOpportunityRanking("AAPL", { pennyIntelligence: b1 });
    expect(result.opportunityScore).toBe(8);
  });

  it("should fall back to b1.unified?.score when other scores are null", () => {
    const b1 = { unified: { score: 14 } };
    const result = defaultOpportunityRanking("AAPL", { pennyIntelligence: b1 });
    expect(result.opportunityScore).toBe(14);
  });

  it("should return null when b1 is null or not an object", () => {
    const b1 = null;
    const result = defaultOpportunityRanking("AAPL", { pennyIntelligence: b1 });
    expect(result.opportunityScore).toBeNull();
  });
});
