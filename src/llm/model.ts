import { ChatOpenAI } from "@langchain/openai";

const API_KEY = process.env.OPENAI_API_KEY;

if (!API_KEY) {
  throw new Error("OPENAI_API_KEY is not set");
}

export function createClassificationModel(): ChatOpenAI {
  return new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0.1,
    apiKey: API_KEY,
  });
}

export function createNotificationModel(): ChatOpenAI {
  return new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0.3,
    apiKey: API_KEY,
  });
}
