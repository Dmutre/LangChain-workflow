import { describe, expect, it, vi } from "vitest";
import { createMockLlmModelModule } from "./test/llm-model-mock-factory.js";

vi.mock("./llm/model.js", () => createMockLlmModelModule());

import { runTriageFromSamplePath } from "./run-sample.js";

describe("Full project path (mocked LLM)", () => {
  it("loads samples/demo-alert.json and returns a complete TriageReport", async () => {
    const report = await runTriageFromSamplePath("samples/demo-alert.json");

    expect(report.alert_id).toMatch(/^INC-/);
    expect(report.severity).toBe("P2");
    expect(report.category).toBe("database");
    expect(report.summary.length).toBeGreaterThan(10);
    expect(report.steps_trace).toEqual(
      expect.arrayContaining([
        "classifyAlert",
        "searchSimilarIncidents",
        "getRunbook",
        "draftNotification",
      ])
    );
    expect(report.slack_draft).toContain("stub");
  });
});
