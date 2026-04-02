import { describe, expect, it } from "vitest";
import { searchSimilarIncidents } from "./search-incidents.js";

describe("searchSimilarIncidents", () => {
  it("returns ranked incidents when keywords match fixture data", async () => {
    const results = await searchSimilarIncidents(["postgres", "connection", "pool"], "database", 2);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toMatch(/^INC-/);
    expect(results[0].category).toBe("database");
  });

  it("returns empty array when nothing scores", async () => {
    const results = await searchSimilarIncidents(["nonexistent-xyz-123"], "unknown", 5);
    expect(results).toEqual([]);
  });
});
