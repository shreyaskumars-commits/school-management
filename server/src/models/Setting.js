import mongoose from "mongoose";

const rolePrompt = {
  systemPrompt: { type: String, required: true },
  temperature: { type: Number, required: true, min: 0, max: 2 },
  maxTokens: { type: Number, required: true, min: 16, max: 4096 },
};

// one document (key "main") holding everything the admin can configure
const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  version: { type: String, enum: ["v1", "v2"], default: "v1" },
  prompts: {
    principal: rolePrompt,
    teacher: rolePrompt,
  },
});

export const Setting = mongoose.model("Setting", settingSchema, "setting");
