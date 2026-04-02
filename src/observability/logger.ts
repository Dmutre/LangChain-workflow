import * as fs from "fs";
import * as path from "path";
import pino from "pino";

export const log = pino({
  level: process.env.LOG_LEVEL ?? "info",
  name: "alert-triage",
});

export interface TraceEntry {
  step: string;
  tool?: string;
  duration_ms: number;
  success: boolean;
  output_summary?: string;
  error?: string;
}

const trace: TraceEntry[] = [];
let currentAlertId = "unknown";

function mergeBindings(context: string, data?: unknown): Record<string, unknown> {
  if (data !== undefined && typeof data === "object" && data !== null && !Array.isArray(data)) {
    return { context, ...(data as Record<string, unknown>) };
  }
  if (data !== undefined) {
    return { context, data };
  }
  return { context };
}

export const logger = {
  reset() {
    trace.length = 0;
    currentAlertId = "unknown";
  },

  setAlertId(id: string) {
    currentAlertId = id;
  },

  info(context: string, message: string, data?: unknown) {
    log.info(mergeBindings(context, data), message);
  },

  warn(context: string, message: string, data?: unknown) {
    log.warn(mergeBindings(context, data), message);
  },

  error(context: string, message: string, data?: unknown) {
    log.error(mergeBindings(context, data), message);
  },

  debug(context: string, message: string, data?: unknown) {
    log.debug(mergeBindings(context, data), message);
  },

  toolCall(tool: string, input: unknown) {
    log.info({ context: "TOOL", tool, input }, `-> ${tool}`);
  },

  toolResult(
    tool: string,
    durationMs: number,
    success: boolean,
    outputSummary?: string,
    error?: string
  ) {
    const entry: TraceEntry = {
      step: tool,
      tool,
      duration_ms: durationMs,
      success,
      output_summary: outputSummary,
      error,
    };
    trace.push(entry);

    if (success) {
      log.info({ context: "TOOL", tool, durationMs, outputSummary }, `[ok] ${tool} completed`);
    } else {
      log.error({ context: "TOOL", tool, durationMs, err: error }, `[fail] ${tool} failed`);
    }
  },

  getTrace(): TraceEntry[] {
    return [...trace];
  },

  getStepsCompleted(): string[] {
    return trace.filter((t) => t.success).map((t) => t.step);
  },

  async saveTrace(outputDir: string = "./logs") {
    const traceData = {
      alert_id: currentAlertId,
      generated_at: new Date().toISOString(),
      trace,
    };

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filePath = path.join(outputDir, `trace-${currentAlertId}-${Date.now()}.json`);
    fs.writeFileSync(filePath, JSON.stringify(traceData, null, 2));
    log.info({ context: "LOGGER", path: filePath }, "Trace file written");
  },
};
