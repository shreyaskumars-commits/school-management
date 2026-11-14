import mongoose from "mongoose";
import { makeReviewSchema } from "./SchoolReview.js";

export const ExcelReview = mongoose.model(
  "ExcelReview",
  makeReviewSchema(),
  "excel_review"
);
