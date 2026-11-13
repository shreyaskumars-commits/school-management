import mongoose from "mongoose";
import { makeReviewSchema } from "./SchoolReview.js";

// rows parsed from the .xlsx the admin uploaded (replaced on every upload)
export const ExcelReview = mongoose.model(
  "ExcelReview",
  makeReviewSchema(),
  "excel_review"
);
