import mongoose from "mongoose";
import { CHAT_DAILY_LIMIT } from "../config/index.js";

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    messages: [messageSchema],
    usage: {
      date: { type: String, default: "" },
      count: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

conversationSchema.statics.reserveMessage = async function (userId) {
  const today = new Date().toISOString().slice(0, 10);

  await this.updateOne(
    { user: userId },
    { $setOnInsert: { messages: [] } },
    { upsert: true }
  );
  await this.updateOne(
    { user: userId, "usage.date": { $ne: today } },
    { $set: { "usage.date": today, "usage.count": 0 } }
  );
  return this.findOneAndUpdate(
    { user: userId, "usage.count": { $lt: CHAT_DAILY_LIMIT } },
    { $inc: { "usage.count": 1 } },
    { returnDocument: "after" }
  );
};

export const Conversation = mongoose.model(
  "Conversation",
  conversationSchema,
  "conversation"
);
