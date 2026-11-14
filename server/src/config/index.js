import "dotenv/config";

export const PORT = Number(process.env.PORT) || 3000;
export const FRONTEND_ORIGIN = "http://localhost:5173";
export const MONGO_URI =
  process.env.MONGO_URI ?? "mongodb://localhost:27017/School";

export const LLM_MODEL = () => process.env.LLM_MODEL;
export const CHAT_DAILY_LIMIT = Number(process.env.CHAT_DAILY_LIMIT) || 50;
export const CHAT_PER_MINUTE = Number(process.env.CHAT_PER_MINUTE) || 10;
export const CHAT_MAX_CHARS = 2000;
export const CHAT_HISTORY_TOKENS = 3000;
