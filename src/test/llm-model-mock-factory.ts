export function createMockLlmModelModule() {
  const stubClassification = {
    severity: "P2" as const,
    category: "database" as const,
    keywords: ["postgres", "connection"],
    confidence: 0.88,
    reasoning: "Stub classification for tests.",
  };
  const stubNotification = {
    slack_message: "[stub] Slack draft",
    email_subject: "[stub] Email subject",
    email_body: "[stub] Email body",
    notify_channels: ["#incidents"],
  };
  return {
    createClassificationModel: () => ({
      withStructuredOutput: () => ({
        invoke: async () => stubClassification,
      }),
    }),
    createNotificationModel: () => ({
      withStructuredOutput: () => ({
        invoke: async () => stubNotification,
      }),
    }),
  };
}
