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
      unique: true, // one conversation per user
    },
    messages: [messageSchema],
    usage: {
      date: { type: String, default: "" }, // e.g. '2026-11-05'
      count: { type: Number, default: 0 }, // messages sent that day
    },
  },
  { timestamps: true }
);

// Returns the conversation if the user has messages left today, else null.
conversationSchema.statics.reserveMessage = async function (userId) {
  const today = new Date().toISOString().slice(0, 10); // UTC day

  // 1. first chat ever: create an empty conversation
  await this.updateOne(
    { user: userId },
    { $setOnInsert: { messages: [] } },
    { upsert: true }
  );
  // 2. new day: reset the counter
  await this.updateOne(
    { user: userId, "usage.date": { $ne: today } },
    { $set: { "usage.date": today, "usage.count": 0 } }
  );
  // 3. add 1 only if still under the limit (one atomic step)
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
