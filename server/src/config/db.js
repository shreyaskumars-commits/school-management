import mongoose from "mongoose";
import { MONGO_URI } from "./index.js";

export async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
}
