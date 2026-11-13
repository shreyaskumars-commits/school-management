import mongoose from "mongoose";

// Same shape as the mock reviews.json data. Used for two collections:
//   school_review : the "school's own DB" (V2 > DB)
//   excel_review  : rows parsed from the admin's uploaded .xlsx (V2 > Excel)
export function makeReviewSchema() {
  return new mongoose.Schema({
    studentId: { type: Number, required: true, index: true },
    studentName: { type: String, required: true },
    department: { type: String, required: true },
    year: { type: Number, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    reviewedBy: { type: String, required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    confidential: { type: Boolean, default: false }, // true = principal only
  });
}

export const SchoolReview = mongoose.model(
  "SchoolReview",
  makeReviewSchema(),
  "school_review"
);
