import * as fs from "fs";
import { Category, Severity, Runbook, RunbookSchema } from "../schemas/agent-validation.schema.js";
import { resolveDataFile } from "../data/resolve-data-path.js";
import { logger } from "../observability/logger.js";

function loadRunbooks(): Runbook[] {
  const filePath = resolveDataFile("runbooks.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw);
  return parsed.map((r: unknown) => RunbookSchema.parse(r));
}

export async function getRunbook(category: Category, severity: Severity): Promise<Runbook> {
  const start = Date.now();
  logger.toolCall("getRunbook", { category, severity });

  try {
    const runbooks = loadRunbooks();

    let runbook = runbooks.find((r) => r.category === category && r.severity === severity);

    if (!runbook && severity !== "P1") {
      const severityOrder: Severity[] = ["P1", "P2", "P3", "P4"];
      const currentIndex = severityOrder.indexOf(severity);
      for (let i = currentIndex - 1; i >= 0; i--) {
        runbook = runbooks.find((r) => r.category === category && r.severity === severityOrder[i]);
        if (runbook) break;
      }
    }

    if (!runbook) {
      runbook = runbooks.find((r) => r.category === "unknown" && r.severity === "P1");
    }

    if (!runbook) {
      throw new Error(`No runbook found for category=${category}, severity=${severity}`);
    }

    logger.toolResult(
      "getRunbook",
      Date.now() - start,
      true,
      `Found runbook ${runbook.id} with ${runbook.steps.length} steps, escalate to ${runbook.escalate_to}`
    );

    return runbook;
  } catch (err) {
    logger.toolResult("getRunbook", Date.now() - start, false, undefined, String(err));
    throw err;
  }
}
