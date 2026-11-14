import mongoose from "mongoose";
import { nextSequence } from "./Counter.js";

const studentSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    year: { type: Number, required: true, min: 1, max: 4, default: 1 },
  },
  { id: false }
);

studentSchema.pre("validate", async function () {
  if (this.isNew && this.id == null) {
    this.id = await nextSequence("student");
  }
});

studentSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Student = mongoose.model("Student", studentSchema, "student");
