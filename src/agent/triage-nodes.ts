import { END, START, StateGraph } from "@langchain/langgraph";
import { classifyAlertWithLlm } from "../llm/classify-alert.js";
import { draftNotificationWithLlm } from "../llm/draft-notification.js";
import { logger } from "../observability/logger.js";
import { AgentState, TriageReportSchema } from "../schemas/agent-validation.schema.js";
import { getRunbook } from "../tools/get-runbook.js";
import { searchSimilarIncidents } from "../tools/search-incidents.js";
import { TriageStateAnnotation } from "./triage-state.js";

type TriageState = typeof TriageStateAnnotation.State;

function buildSummary(state: TriageState, durationMs: number): string {
  const { classification, similarIncidents, runbook } = state;
  if (!classification) return "Triage failed: could not classify alert.";

  const parts: string[] = [
    `[${classification.severity}] ${classification.category.toUpperCase()} incident detected.`,
    classification.reasoning,
  ];

  if (similarIncidents.length > 0) {
    parts.push(
      `${similarIncidents.length} similar past incident(s) found (e.g. ${similarIncidents[0].id}: ${similarIncidents[0].title}).`
    );
  }

  if (runbook) {
    parts.push(
      `Runbook available with ${runbook.steps.length} steps. Escalate to: ${runbook.escalate_to}. Estimated resolution: ~${runbook.estimated_resolution_minutes} minutes.`
    );
  }

  parts.push(`Triage completed in ${(durationMs / 1000).toFixed(1)}s.`);

  if (state.errors.length > 0) {
    parts.push(`Note: ${state.errors.length} non-critical step(s) failed during triage.`);
  }

  return parts.join(" ");
}

function toAgentState(state: TriageState): AgentState {
  return {
    alert_id: state.alertId,
    input: state.safeInput,
    classification: state.classification,
    similar_incidents: state.similarIncidents,
    runbook: state.runbook,
    notification: state.notification,
    steps_completed: [],
    errors: state.errors,
    started_at: state.startedAt,
    completed_at: null,
  };
}

async function classifyNode(state: TriageState) {
  logger.info("AGENT", "Step 1/4: Classifying alert...");
  const classification = await classifyAlertWithLlm(state.safeInput.raw_text);
  return { classification };
}

async function searchNode(state: TriageState) {
  logger.info("AGENT", "Step 2/4: Searching similar incidents...");
  const classification = state.classification;
  const keywords = classification?.keywords ?? [];
  const category = classification?.category ?? "unknown";

  try {
    const similarIncidents = await searchSimilarIncidents(keywords, category);
    return { similarIncidents };
  } catch (err) {
    return {
      errors: [`search_incidents: ${String(err)}`],
      similarIncidents: [],
    };
  }
}

async function runbookNode(state: TriageState) {
  logger.info("AGENT", "Step 3/4: Fetching runbook...");
  const classification = state.classification;
  if (!classification) {
    return { errors: ["get_runbook: missing classification"], runbook: null };
  }

  try {
    const runbook = await getRunbook(classification.category, classification.severity);
    return { runbook };
  } catch (err) {
    return {
      errors: [`get_runbook: ${String(err)}`],
      runbook: null,
    };
  }
}

async function draftNode(state: TriageState) {
  logger.info("AGENT", "Step 4/4: Drafting notification...");
  try {
    const notification = await draftNotificationWithLlm(toAgentState(state));
    return { notification };
  } catch (err) {
    return {
      errors: [`draft_notification: ${String(err)}`],
      notification: null,
    };
  }
}

async function finalizeNode(state: TriageState) {
  const durationMs = Date.now() - state.startMs;
  const classification = state.classification;

  if (!classification) {
    const report = TriageReportSchema.parse({
      alert_id: state.alertId,
      severity: "P2" as const,
      category: "unknown" as const,
      confidence: 0,
      root_cause_hypothesis: "Classification unavailable.",
      similar_incidents: [],
      runbook_steps: [],
      escalate_to: "oncall-lead",
      estimated_resolution_minutes: 60,
      slack_draft: "🔴 Incident detected. Investigating.",
      summary: buildSummary(state, durationMs),
      duration_ms: durationMs,
      steps_trace: logger.getStepsCompleted(),
    });
    return { report };
  }

  const report = TriageReportSchema.parse({
    alert_id: state.alertId,
    severity: classification.severity,
    category: classification.category,
    confidence: classification.confidence,
    root_cause_hypothesis: classification.reasoning,
    similar_incidents: state.similarIncidents.map((inc) => ({
      id: inc.id,
      title: inc.title,
      resolution_summary: inc.resolution_summary,
    })),
    runbook_steps: state.runbook?.steps ?? [],
    escalate_to: state.runbook?.escalate_to ?? "oncall-lead",
    estimated_resolution_minutes: state.runbook?.estimated_resolution_minutes ?? 60,
    slack_draft: state.notification?.slack_message ?? "🔴 Incident detected. Investigating.",
    summary: buildSummary(state, durationMs),
    duration_ms: durationMs,
    steps_trace: logger.getStepsCompleted(),
  });

  logger.info("AGENT", `Triage complete in ${durationMs}ms`, {
    severity: report.severity,
    category: report.category,
    errors: state.errors,
  });

  return { report };
}

export function buildTriageGraph() {
  const graph = new StateGraph(TriageStateAnnotation)
    .addNode("classify", classifyNode)
    .addNode("search_similar_incidents", searchNode)
    .addNode("get_runbook", runbookNode)
    .addNode("draft_notification", draftNode)
    .addNode("finalize", finalizeNode)
    .addEdge(START, "classify")
    .addEdge("classify", "search_similar_incidents")
    .addEdge("search_similar_incidents", "get_runbook")
    .addEdge("get_runbook", "draft_notification")
    .addEdge("draft_notification", "finalize")
    .addEdge("finalize", END);

  return graph.compile();
}
