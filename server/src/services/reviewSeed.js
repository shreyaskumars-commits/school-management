import { readFileSync } from "node:fs";
import { Review } from "../models/Review.js";

const SEED_FILE = new URL("../data/seed/reviews.json", import.meta.url);

// loads data/seed/reviews.json, only when the review collection is empty
export async function seedReviews() {
  if ((await Review.countDocuments()) > 0) return;
  const { students, reviews } = JSON.parse(readFileSync(SEED_FILE, "utf8"));
  const byId = new Map(students.map((s) => [s.studentId, s]));
  await Review.insertMany(
    reviews.map((r) => {
      const s = byId.get(r.studentId);
      return { ...r, studentName: s.name, department: s.department, year: s.year };
    })
  );
  console.log(`Seeded ${reviews.length} student reviews`);
}

