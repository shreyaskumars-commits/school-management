import mongoose from "mongoose";

export function makeReviewSchema() {
  return new mongoose.Schema({
    studentId: { type: Number, required: true, index: true },
    studentName: { type: String, required: true },
    department: { type: String, required: true },
    year: { type: Number, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    reviewedBy: { type: String, required: true },
    date: { type: String, required: true },
    confidential: { type: Boolean, default: false },
  });
}

export const SchoolReview = mongoose.model(
  "SchoolReview",
  makeReviewSchema(),
  "school_review"
);
