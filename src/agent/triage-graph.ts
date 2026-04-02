import { sanitizeInput } from "../guardrails/input-sanitizer.js";
import { logger } from "../observability/logger.js";
import type { AlertInput, TriageReport } from "../schemas/agent-validation.schema.js";
import { buildTriageGraph } from "./triage-nodes.js";

export interface TriageOptions {
  saveTrace?: boolean;
  traceOutputDir?: string;
}

let compiledGraph: ReturnType<typeof buildTriageGraph> | null = null;

function getCompiledGraph() {
  if (!compiledGraph) {
    compiledGraph = buildTriageGraph();
  }
  return compiledGraph;
}

export async function runTriageAgent(
  input: AlertInput,
  options: TriageOptions = {}
): Promise<TriageReport> {
  const alertId = `INC-${Date.now()}`;
  const startedAt = new Date().toISOString();
  const startMs = Date.now();

  logger.reset();
  logger.setAlertId(alertId);
  logger.info("AGENT", `Starting triage for alert ${alertId}`, {
    source: input.source,
    text_length: input.raw_text.length,
  });

  const sanitization = sanitizeInput(input);

  if (sanitization.blocked) {
    logger.error("AGENT", "Input blocked by guardrails", {
      reason: sanitization.block_reason,
    });
    throw new Error(`Input rejected: ${sanitization.block_reason}`);
  }

  if (sanitization.warnings.length > 0) {
    logger.warn("AGENT", "Input sanitization warnings", { warnings: sanitization.warnings });
  }

  const safeInput: AlertInput = { ...input, raw_text: sanitization.sanitized_text };

  const graph = getCompiledGraph();
  const result = await graph.invoke({
    alertId,
    startedAt,
    startMs,
    safeInput,
    classification: null,
    similarIncidents: [],
    runbook: null,
    notification: null,
    errors: [],
    report: null,
  });

  const report = result.report;
  if (!report) {
    throw new Error("Triage graph finished without a report");
  }

  if (options.saveTrace) {
    await logger.saveTrace(options.traceOutputDir);
  }

  return report;
}
