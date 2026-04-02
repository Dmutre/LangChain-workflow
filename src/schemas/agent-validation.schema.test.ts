import { describe, expect, it } from "vitest";
import { AlertInputSchema, TriageReportSchema } from "./agent-validation.schema.js";

describe("AlertInputSchema", () => {
  it("accepts a valid alert payload", () => {
    const parsed = AlertInputSchema.parse({
      raw_text: "At least ten characters here for a valid production alert.",
      source: "pagerduty",
    });
    expect(parsed.source).toBe("pagerduty");
    expect(parsed.raw_text.length).toBeGreaterThanOrEqual(10);
  });

  it("rejects text shorter than schema minimum", () => {
    expect(() =>
      AlertInputSchema.parse({
        raw_text: "short",
        source: "x",
      })
    ).toThrow();
  });
});

describe("TriageReportSchema", () => {
  it("parses a complete triage report object", () => {
    const report = TriageReportSchema.parse({
      alert_id: "INC-1",
      severity: "P2",
      category: "database",
      confidence: 0.9,
      root_cause_hypothesis: "Pool exhausted",
      similar_incidents: [{ id: "a", title: "t", resolution_summary: "r" }],
      runbook_steps: ["step1"],
      escalate_to: "oncall",
      estimated_resolution_minutes: 30,
      slack_draft: "msg",
      summary: "human summary",
      duration_ms: 100,
      steps_trace: ["classifyAlert"],
    });
    expect(report.steps_trace).toEqual(["classifyAlert"]);
  });
});
