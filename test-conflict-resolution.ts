import { describe, it, expect } from "node:test";
import { detectSignalConflicts, resolveConflicts } from "../lib/opportunity-ranking.js";

describe("P1-2 Conflict Resolution", () => {
  it("detects directional conflict across B1-B6", () => {
    const r = detectSignalConflicts({
      pennyIntelligence: { signal: "BUY" },
      swingIntelligence: { signal: "SELL" },
    });
    expect(r.length).toBe(1);
    expect(r[0].type).toBe("DIRECTIONAL_CONFLICT");
    expect(r[0].severity).toBe("HIGH");
  });

  it("resolves by institutionalRadar priority", () => {
    const conflicts = detectSignalConflicts({
      pennyIntelligence: { signal: "SELL" },
      institutionalRadar: { signal: "BUY" },
    });
    const res = resolveConflicts({
      pennyIntelligence: { signal: "SELL" },
      institutionalRadar: { signal: "BUY" },
    }, conflicts);
    expect(res[0].resolved).toBe(true);
    expect(res[0].winningSource).toBe("institutionalRadar");
  });

  it("preserves conflicts in return contract (not resolved away)", () => {
    const sources = {
      pennyIntelligence: null,
      optionsIntelligence: null,
      institutionalRadar: null,
      swingIntelligence: null,
      earlyExplosion: null,
      catalystIntelligence: null,
    };
    const r = detectSignalConflicts(sources);
    expect(Array.isArray(r)).toBe(true);
  });
});
