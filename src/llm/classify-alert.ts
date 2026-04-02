import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import pRetry from "p-retry";
import { ClassifiedAlert, ClassifiedAlertSchema } from "../schemas/agent-validation.schema.js";
import { buildSafeSystemPrompt } from "../guardrails/input-sanitizer.js";
import { logger } from "../observability/logger.js";
import { createClassificationModel } from "./model.js";

const CLASSIFICATION_SYSTEM_PROMPT = buildSafeSystemPrompt(`
You are an expert SRE (Site Reliability Engineer) analyzing production alerts.
Your job is to classify incoming alerts by severity and category.

Severity levels:
- P1: Critical. Service is down or severely degraded. Revenue/data at risk. Immediate action required.
- P2: High. Significant impact on users or business. Action required within 1 hour.
- P3: Medium. Partial degradation, workaround available. Action within 24 hours.
- P4: Low. Minor issue, cosmetic, or informational. Schedule for next sprint.

Categories:
- database: DB connection issues, query failures, deadlocks, replication lag
- network: connectivity, DNS, firewall, packet loss, timeouts between services
- payment: payment processing, webhooks, gateway errors, transaction failures
- auth: authentication, authorization, JWT, session, token issues
- infra: CPU, memory, disk, Kubernetes, cloud infrastructure
- application: application errors, crashes, memory leaks, logic errors
- unknown: cannot determine from available information

Respond ONLY with a valid JSON object matching this schema exactly:
{
  "severity": "P1" | "P2" | "P3" | "P4",
  "category": "database" | "network" | "payment" | "auth" | "infra" | "application" | "unknown",
  "keywords": string[], // 3-7 key technical terms from the alert
  "confidence": number, // 0.0 to 1.0
  "reasoning": string // 1-2 sentences explaining your classification
}
`);

const FALLBACK: ClassifiedAlert = {
  severity: "P2",
  category: "unknown",
  keywords: [],
  confidence: 0,
  reasoning: "Classification failed after retries. Defaulting to P2/unknown for safety.",
};

export async function classifyAlertWithLlm(
  alertText: string,
  maxAttempts: number = 3
): Promise<ClassifiedAlert> {
  const start = Date.now();
  logger.toolCall("classifyAlert", { alert_preview: alertText.slice(0, 100) });

  const model = createClassificationModel().withStructuredOutput(ClassifiedAlertSchema);

  try {
    const validated = await pRetry(
      async () =>
        model.invoke([
          new SystemMessage(CLASSIFICATION_SYSTEM_PROMPT),
          new HumanMessage(`Classify this alert:\n\n${alertText}`),
        ]),
      {
        retries: Math.max(0, maxAttempts - 1),
        minTimeout: 500,
        factor: 2,
        onFailedAttempt: ({ error, attemptNumber, retriesLeft }) => {
          logger.warn(
            "classifyAlert",
            `Attempt ${attemptNumber} failed (${retriesLeft} retries left): ${error instanceof Error ? error.message : String(error)}`
          );
        },
      }
    );

    logger.toolResult(
      "classifyAlert",
      Date.now() - start,
      true,
      `severity=${validated.severity}, category=${validated.category}, confidence=${validated.confidence}`
    );

    return validated;
  } catch (err) {
    logger.toolResult("classifyAlert", Date.now() - start, false, undefined, String(err));
    return FALLBACK;
  }
}
