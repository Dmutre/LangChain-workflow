import "dotenv/config";
import { readFileSync } from "fs";
import { resolve } from "path";
import { runTriageAgent } from "./agent/triage-graph.js";
import { AlertInputSchema } from "./schemas/agent-validation.schema.js";

const DEMO_SAMPLE = "samples/demo-alert.json";

const argv = process.argv.slice(2);
const useDemo =
  argv.includes("--demo") ||
  argv.includes("-d") ||
  process.env.DEMO === "1" ||
  process.env.DEMO_MODE === "1";

const positional = argv.filter((a) => !a.startsWith("-"));
const samplePath = useDemo ? DEMO_SAMPLE : (positional[0] ?? "samples/alert-p2.json");
const filePath = resolve(process.cwd(), samplePath);

const raw = readFileSync(filePath, "utf-8");
const input = AlertInputSchema.parse(JSON.parse(raw));

const report = await runTriageAgent(input, {
  saveTrace: process.env.SAVE_TRACE === "1",
  traceOutputDir: process.env.TRACE_DIR ?? "./logs",
});

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
