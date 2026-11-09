import mongoose from "mongoose";
import { nextSequence } from "./Counter.js";

const studentSchema = new mongoose.Schema(
  {
    // auto-incremented number: 1, 2, 3, ... (set below, never sent by clients)
    id: { type: Number, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    year: { type: Number, required: true, min: 1, max: 4, default: 1 },
  },
  // turn off mongoose's built-in string `id` virtual (the ObjectId); we store our own `id`
  { id: false }
);

// give every new student the next number before it is validated and saved
// (runs for Student.create, doc.save and insertMany)
studentSchema.pre("validate", async function () {
  if (this.isNew && this.id == null) {
    this.id = await nextSequence("student");
  }
});

// hide Mongo's internal _id and __v from API responses; `id` is the number above
studentSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Student = mongoose.model("Student", studentSchema, "student");
