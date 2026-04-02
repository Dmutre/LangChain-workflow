import "dotenv/config";
import { readFileSync } from "fs";
import { resolve } from "path";
import { runTriageAgent } from "./agent/triage-graph.js";
import { AlertInputSchema } from "./schemas/agent-validation.schema.js";

const samplePath = process.argv[2] ?? "samples/alert-p2.json";
const filePath = resolve(process.cwd(), samplePath);

const raw = readFileSync(filePath, "utf-8");
const input = AlertInputSchema.parse(JSON.parse(raw));

const report = await runTriageAgent(input, {
  saveTrace: process.env.SAVE_TRACE === "1",
  traceOutputDir: process.env.TRACE_DIR ?? "./logs",
});

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
