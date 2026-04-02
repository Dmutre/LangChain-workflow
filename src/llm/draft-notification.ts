import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import pRetry from "p-retry";
import {
  AgentState,
  NotificationDraft,
  NotificationDraftSchema,
} from "../schemas/agent-validation.schema.js";
import { buildSafeSystemPrompt } from "../guardrails/input-sanitizer.js";
import { logger } from "../observability/logger.js";
import { createNotificationModel } from "./model.js";

const NOTIFICATION_SYSTEM_PROMPT = buildSafeSystemPrompt(`
You are an SRE writing incident notifications. Be concise, factual, and actionable.
Use standard incident communication conventions.

For Slack messages:
- Use emoji for severity: 🔴 P1, 🟠 P2, 🟡 P3, 🟢 P4
- Include: severity, category, brief description, who is being paged, ETA
- Max 3-4 lines
- Use Slack markdown (*bold*, \`code\`)

For email:
- Professional tone
- Subject: [INCIDENT][Pn] Brief description
- Body: What happened, impact, who is handling it, next update time

Respond ONLY with valid JSON:
{
  "slack_message": string,
  "email_subject": string,
  "email_body": string,
  "notify_channels": string[] // e.g. ["#incidents", "#backend-team"]
}
`);

const SEVERITY_CHANNELS: Record<string, string[]> = {
  P1: ["#incidents", "#engineering-all", "#status"],
  P2: ["#incidents", "#backend-team"],
  P3: ["#backend-team"],
  P4: ["#tech-debt"],
};

export async function draftNotificationWithLlm(
  state: AgentState,
  maxAttempts: number = 3
): Promise<NotificationDraft> {
  const start = Date.now();
  logger.toolCall("draftNotification", {
    severity: state.classification?.severity,
    category: state.classification?.category,
  });

  const context = {
    alert_text: state.input.raw_text.slice(0, 500),
    severity: state.classification?.severity ?? "P2",
    category: state.classification?.category ?? "unknown",
    escalate_to: state.runbook?.escalate_to ?? "oncall-lead",
    runbook_steps_count: state.runbook?.steps.length ?? 0,
    similar_incidents_count: state.similar_incidents.length,
    estimated_resolution: state.runbook?.estimated_resolution_minutes ?? 60,
  };

  const model = createNotificationModel().withStructuredOutput(NotificationDraftSchema);

  const fallback = (): NotificationDraft => ({
    slack_message: `🔴 *${context.severity} Incident* — ${context.category} issue detected. Paging ${context.escalate_to}.`,
    email_subject: `[INCIDENT][${context.severity}] ${context.category} issue`,
    email_body: `An incident has been detected. The on-call team (${context.escalate_to}) has been notified.`,
    notify_channels: SEVERITY_CHANNELS[context.severity] ?? ["#incidents"],
  });

  try {
    const validated = await pRetry(
      async () => {
        const parsed = await model.invoke([
          new SystemMessage(NOTIFICATION_SYSTEM_PROMPT),
          new HumanMessage(
            `Draft incident notifications for:\n${JSON.stringify(context, null, 2)}`
          ),
        ]);
        parsed.notify_channels = SEVERITY_CHANNELS[context.severity] ?? ["#incidents"];
        return NotificationDraftSchema.parse(parsed);
      },
      {
        retries: Math.max(0, maxAttempts - 1),
        minTimeout: 500,
        factor: 2,
        onFailedAttempt: ({ error, attemptNumber, retriesLeft }) => {
          logger.warn(
            "draftNotification",
            `Attempt ${attemptNumber} failed (${retriesLeft} retries left): ${error instanceof Error ? error.message : String(error)}`
          );
        },
      }
    );

    logger.toolResult(
      "draftNotification",
      Date.now() - start,
      true,
      `Drafted for channels: ${validated.notify_channels.join(", ")}`
    );

    return validated;
  } catch (err) {
    logger.toolResult("draftNotification", Date.now() - start, false, undefined, String(err));
    return fallback();
  }
}
