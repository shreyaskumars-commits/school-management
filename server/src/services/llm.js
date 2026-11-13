import OpenAI from "openai";
import { LLM_MODEL } from "../config/index.js";

class NotConfiguredError extends Error {}


let client;
function getClient() {
  if (!process.env.OPENAI_API_KEY || !LLM_MODEL()) {
    throw new NotConfiguredError("OPENAI_API_KEY or LLM_MODEL is missing");
  }
  client ??= new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 30 * 1000, // give up on one attempt after 30 seconds
    maxRetries: 2, // retry 429, 5xx and timeouts up to 2 times
  });
  return client;
}


export const llm = {
  // options (V2 only): { temperature, maxTokens } set by the admin
  startChatStream(messages, signal, options = {}) {
    const params = { model: LLM_MODEL(), messages, stream: true };
    if (options.temperature != null) params.temperature = options.temperature;
    if (options.maxTokens != null) params.max_completion_tokens = options.maxTokens;
    return getClient().chat.completions.create(
      params,
      { signal } // request options go in the SECOND argument
    );
  },
};


export function toFriendlyError(err) {
  if (err instanceof NotConfiguredError) {
    console.error(err.message);
    return { status: 500, message: "AI is not configured correctly." };
  }
  if (err instanceof OpenAI.APIConnectionTimeoutError) {
    return { status: 500, message: "The AI took too long. Please try again." };
  }
  if (err instanceof OpenAI.RateLimitError) {
    return { status: 429, message: "The AI is busy right now. Try in a minute." };
  }
  if (err instanceof OpenAI.AuthenticationError) {
    console.error("Check OPENAI_API_KEY on the server");
    return { status: 500, message: "AI is not configured correctly." };
  }
 if (err instanceof OpenAI.APIError) {
  console.error("========== OPENAI API ERROR ==========");
  console.error("Status:", err.status);
  console.error("Message:", err.message);
  console.error("Code:", err.code);
  console.error("Type:", err.type);
  console.error("Param:", err.param);
  console.error("Request ID:", err.request_id);
  console.error("======================================");

  return {
    status: 500,
    message: err.message || "AI service error"
  };
}
  console.error(err);
  return { status: 500, message: "Something went wrong." };
}

export const estimateTokens = (text) => Math.ceil(text.length / 4);


export function trimHistory(messages, { maxTokens = 3000, maxMessages = 20 } = {}) {
  const kept = [];
  let used = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const cost = estimateTokens(messages[i].content);
    if (used + cost > maxTokens || kept.length >= maxMessages) break;
    kept.unshift(messages[i]);
    used += cost;
  }
  return kept;
}
