import { ChatOpenAI } from "@langchain/openai";

export function createClassificationModel(): ChatOpenAI {
  return new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0.1,
  });
}

export function createNotificationModel(): ChatOpenAI {
  return new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0.3,
  });
}
