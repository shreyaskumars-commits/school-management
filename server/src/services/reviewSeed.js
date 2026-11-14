import { readFileSync } from "node:fs";
import { Review } from "../models/Review.js";
import { SchoolReview } from "../models/SchoolReview.js";

const SEED_FILE = new URL("../data/seed/reviews.json", import.meta.url);

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

const SCHOOL_SEED_FILE = new URL("../data/seed/school_reviews.json", import.meta.url);

export function loadSchoolSeed() {
  const { students, reviews } = JSON.parse(readFileSync(SCHOOL_SEED_FILE, "utf8"));
  const byId = new Map(students.map((s) => [s.studentId, s]));
  return reviews.map((r) => {
    const s = byId.get(r.studentId);
    return { ...r, studentName: s.name, department: s.department, year: s.year };
  });
}

export async function seedSchoolReviews() {
  if ((await SchoolReview.countDocuments()) > 0) return;
  const rows = loadSchoolSeed();
  await SchoolReview.insertMany(rows);
  console.log(`Seeded ${rows.length} school_review documents`);
}
