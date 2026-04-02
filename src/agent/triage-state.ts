import { Annotation } from "@langchain/langgraph";
import type {
  AlertInput,
  ClassifiedAlert,
  NotificationDraft,
  Runbook,
  SimilarIncident,
  TriageReport,
} from "../schemas/agent-validation.schema.js";

export const TriageStateAnnotation = Annotation.Root({
  alertId: Annotation<string>,
  startedAt: Annotation<string>,
  startMs: Annotation<number>,
  safeInput: Annotation<AlertInput>,
  classification: Annotation<ClassifiedAlert | null>,
  similarIncidents: Annotation<SimilarIncident[]>,
  runbook: Annotation<Runbook | null>,
  notification: Annotation<NotificationDraft | null>,
  errors: Annotation<string[]>({
    reducer: (left, right) => [...left, ...right],
    default: () => [],
  }),
  report: Annotation<TriageReport | null>,
});
