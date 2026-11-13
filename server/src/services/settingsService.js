import { Setting } from "../models/Setting.js";

const BASE_PERSONA = `You are CollegeBuddy, a helpful assistant inside a college Student Management Portal.`;

export const DEFAULT_PROMPTS = {
  principal: {
    systemPrompt: `${BASE_PERSONA}
You are talking to the principal, who may see every review, including confidential ones.
Give a clear overview, point out students who need attention, and keep answers short.`,
    temperature: 0.3,
    maxTokens: 500,
  },
  teacher: {
    systemPrompt: `${BASE_PERSONA}
You are talking to a teacher, who may see open (non-confidential) reviews only.
Be practical and encouraging, and keep answers short.`,
    temperature: 0.5,
    maxTokens: 400,
  },
};

// returns the one settings document, creating it with defaults the first time
export async function getSettings() {
  let doc = await Setting.findOne({ key: "main" });
  if (!doc) {
    doc = await Setting.findOneAndUpdate(
      { key: "main" },
      { $setOnInsert: { key: "main", version: "v1", v2Source: "db", prompts: DEFAULT_PROMPTS } },
      { upsert: true, returnDocument: "after" }
    );
  }
  return doc;
}

// what any logged-in user may know about the current mode
export function publicView(s) {
  return {
    version: s.version,
    source: s.version === "v2" ? s.v2Source : "legacy",
  };
}

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

// validates the admin's PUT body; returns { error } or { patch }
export function validateConfig(body) {
  const patch = {};
  if (body.version !== undefined) {
    if (!["v1", "v2"].includes(body.version)) return { error: "version must be v1 or v2" };
    patch.version = body.version;
  }
  if (body.v2Source !== undefined) {
    if (!["db", "excel"].includes(body.v2Source)) return { error: "v2Source must be db or excel" };
    patch.v2Source = body.v2Source;
  }
  for (const role of ["principal", "teacher"]) {
    const p = body.prompts?.[role];
    if (p === undefined) continue;
    const { systemPrompt, temperature, maxTokens } = p;
    if (typeof systemPrompt !== "string" || !systemPrompt.trim() || systemPrompt.length > 4000) {
      return { error: `${role}: system prompt must be 1 to 4000 characters` };
    }
    if (!isNum(temperature) || temperature < 0 || temperature > 2) {
      return { error: `${role}: temperature must be between 0 and 2` };
    }
    if (!Number.isInteger(maxTokens) || maxTokens < 16 || maxTokens > 4096) {
      return { error: `${role}: max tokens must be a whole number from 16 to 4096` };
    }
    patch[`prompts.${role}`] = { systemPrompt: systemPrompt.trim(), temperature, maxTokens };
  }
  return { patch };
}

export async function updateSettings(patch) {
  await getSettings();
  return Setting.findOneAndUpdate({ key: "main" }, { $set: patch }, { returnDocument: "after" });
}
