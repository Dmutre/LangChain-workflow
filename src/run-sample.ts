import { readFileSync } from "fs";
import { resolve } from "path";
import { runTriageAgent } from "./agent/triage-graph.js";
import type { AlertInput, TriageReport } from "./schemas/agent-validation.schema.js";
import { AlertInputSchema } from "./schemas/agent-validation.schema.js";

const DEMO_SAMPLE = "samples/demo-alert.json";

export function resolveCliSamplePath(argv: string[]): string {
  const args = argv.slice(2);
  const useDemo =
    args.includes("--demo") ||
    args.includes("-d") ||
    process.env.DEMO === "1" ||
    process.env.DEMO_MODE === "1";
  const positional = args.filter((a) => !a.startsWith("-"));
  return useDemo ? DEMO_SAMPLE : (positional[0] ?? "samples/alert-p2.json");
}

export async function runTriageFromSamplePath(relativePath: string): Promise<TriageReport> {
  const filePath = resolve(process.cwd(), relativePath);
  const raw = readFileSync(filePath, "utf-8");
  const input: AlertInput = AlertInputSchema.parse(JSON.parse(raw));
  return runTriageAgent(input, {
    saveTrace: process.env.SAVE_TRACE === "1",
    traceOutputDir: process.env.TRACE_DIR ?? "./logs",
  });
}
