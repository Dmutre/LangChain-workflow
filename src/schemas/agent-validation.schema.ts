import { z } from "zod";

export const AlertInputSchema = z.object({
  raw_text: z.string().min(10, "Alert text too short").max(5000, "Alert text too long"),
  source: z.string().optional().default("unknown"),
  timestamp: z
    .string()
    .datetime()
    .optional()
    .default(() => new Date().toISOString()),
  metadata: z.record(z.string(), z.string()).optional().default({}),
});

export type AlertInput = z.infer<typeof AlertInputSchema>;

export const SeveritySchema = z.enum(["P1", "P2", "P3", "P4"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const CategorySchema = z.enum([
  "database",
  "network",
  "payment",
  "auth",
  "infra",
  "application",
  "unknown",
]);
export type Category = z.infer<typeof CategorySchema>;

export const ClassifiedAlertSchema = z.object({
  severity: SeveritySchema,
  category: CategorySchema,
  keywords: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});
export type ClassifiedAlert = z.infer<typeof ClassifiedAlertSchema>;

export const SimilarIncidentSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: CategorySchema,
  severity: SeveritySchema,
  resolved_in_minutes: z.number(),
  resolution_summary: z.string(),
});
export type SimilarIncident = z.infer<typeof SimilarIncidentSchema>;

export const RunbookSchema = z.object({
  id: z.string(),
  category: CategorySchema,
  severity: SeveritySchema,
  steps: z.array(z.string()),
  escalate_to: z.string(),
  estimated_resolution_minutes: z.number(),
});
export type Runbook = z.infer<typeof RunbookSchema>;

export const NotificationDraftSchema = z.object({
  slack_message: z.string(),
  email_subject: z.string(),
  email_body: z.string(),
  notify_channels: z.array(z.string()),
});
export type NotificationDraft = z.infer<typeof NotificationDraftSchema>;

export const AgentStateSchema = z.object({
  alert_id: z.string(),
  input: AlertInputSchema,
  classification: ClassifiedAlertSchema.nullable().default(null),
  similar_incidents: z.array(SimilarIncidentSchema).default([]),
  runbook: RunbookSchema.nullable().default(null),
  notification: NotificationDraftSchema.nullable().default(null),
  steps_completed: z.array(z.string()).default([]),
  errors: z.array(z.string()).default([]),
  started_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable().default(null),
});
export type AgentState = z.infer<typeof AgentStateSchema>;

export const TriageReportSchema = z.object({
  alert_id: z.string(),
  severity: SeveritySchema,
  category: CategorySchema,
  confidence: z.number(),
  root_cause_hypothesis: z.string(),
  similar_incidents: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      resolution_summary: z.string(),
    })
  ),
  runbook_steps: z.array(z.string()),
  escalate_to: z.string(),
  estimated_resolution_minutes: z.number(),
  slack_draft: z.string(),
  summary: z.string(),
  duration_ms: z.number(),
  steps_trace: z.array(z.string()),
});
export type TriageReport = z.infer<typeof TriageReportSchema>;
