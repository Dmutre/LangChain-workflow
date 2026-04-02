import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";

/** Which backend to use; set via `LLM_PROVIDER`. */
export type LlmProvider = "gemini" | "anthropic" | "openai";

const Env = {
  provider: "LLM_PROVIDER",
  gemini: { apiKey: "GOOGLE_API_KEY", model: "GEMINI_MODEL" },
  anthropic: { apiKey: "ANTHROPIC_API_KEY", model: "ANTHROPIC_MODEL" },
  openai: { apiKey: "OPENAI_API_KEY", model: "OPENAI_MODEL" },
} as const;

const DEFAULT_PROVIDER: LlmProvider = "gemini";

/** Normalized `LLM_PROVIDER` value → canonical id. */
const PROVIDER_ALIASES: Record<string, LlmProvider> = {
  gemini: "gemini",
  google: "gemini",
  anthropic: "anthropic",
  claude: "anthropic",
  openai: "openai",
  chatgpt: "openai",
};

const DEFAULT_MODELS: Record<LlmProvider, string> = {
  gemini: "gemini-2.0-flash",
  anthropic: "claude-haiku-4-5",
  openai: "gpt-4o-mini",
};

const Temperature = {
  classification: 0.1,
  notification: 0.3,
} as const;

const VALID_PROVIDER_INPUTS = Object.keys(PROVIDER_ALIASES).join(", ");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for the active LLM provider (set ${Env.provider})`);
  }
  return value;
}

function resolveProvider(raw: string | undefined): LlmProvider {
  const key = (raw ?? "").toLowerCase().trim();
  if (key === "") {
    return DEFAULT_PROVIDER;
  }
  const provider = PROVIDER_ALIASES[key];
  if (!provider) {
    throw new Error(
      `${Env.provider} must be one of: ${VALID_PROVIDER_INPUTS} (got: ${JSON.stringify(raw)})`
    );
  }
  return provider;
}

/** Resolved provider from `LLM_PROVIDER` (default: gemini). */
export function getActiveLlmProvider(): LlmProvider {
  return resolveProvider(process.env[Env.provider] ?? DEFAULT_PROVIDER);
}

type BuildChat = (temperature: number) => BaseChatModel;

const buildChatByProvider: Record<LlmProvider, BuildChat> = {
  gemini: (temperature) =>
    new ChatGoogleGenerativeAI({
      model: process.env[Env.gemini.model] ?? DEFAULT_MODELS.gemini,
      temperature,
      apiKey: requireEnv(Env.gemini.apiKey),
    }),

  anthropic: (temperature) =>
    new ChatAnthropic({
      model: process.env[Env.anthropic.model] ?? DEFAULT_MODELS.anthropic,
      temperature,
      apiKey: requireEnv(Env.anthropic.apiKey),
    }),

  openai: (temperature) =>
    new ChatOpenAI({
      model: process.env[Env.openai.model] ?? DEFAULT_MODELS.openai,
      temperature,
      apiKey: requireEnv(Env.openai.apiKey),
    }),
};

function createChatModel(temperature: number): BaseChatModel {
  const provider = getActiveLlmProvider();
  return buildChatByProvider[provider](temperature);
}

export function createClassificationModel(): BaseChatModel {
  return createChatModel(Temperature.classification);
}

export function createNotificationModel(): BaseChatModel {
  return createChatModel(Temperature.notification);
}
