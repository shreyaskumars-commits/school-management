import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  Username: { type: String, required: true, trim: true, unique: true },
  Password: { type: String, required: true },
  role: { type: String, enum: ["principal", "teacher", "admin"], default: "teacher" },
});

export const User = mongoose.model("User", userSchema, "user");
