import { SchoolReview } from "../models/SchoolReview.js";
import { Student } from "../models/Student.js";
import { getSettings, publicView } from "../services/settingsService.js";

// GET /config: what the portal needs to know about the current mode
export async function publicConfig(req, res) {
  res.json(publicView(await getSettings()));
}

// POST /remarks: a teacher (or principal) adds a review to the school DB
export async function addRemark(req, res) {
  const settings = await getSettings();
  if (!publicView(settings).remarksEnabled) {
    return res
      .status(409)
      .json({ error: "Remarks can only be added when V2 is connected to the school DB" });
  }

  const { studentId, rating, comment } = req.body ?? {};
  const text = String(comment ?? "").trim();
  if (!Number.isInteger(studentId) || studentId < 1) {
    return res.status(400).json({ error: "studentId must be a positive whole number" });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "rating must be a whole number from 1 to 5" });
  }
  if (!text || text.length > 500) {
    return res.status(400).json({ error: "comment must be 1 to 500 characters" });
  }

  const student = await Student.findOne({ id: studentId }).lean();
  if (!student) return res.status(404).json({ error: "Student not found" });

  const review = await SchoolReview.create({
    studentId: student.id,
    studentName: student.name,
    department: student.department,
    year: student.year,
    rating,
    comment: text,
    reviewedBy: req.user.role,
    date: new Date().toISOString().slice(0, 10),
    // teachers cannot read confidential reviews, so their remarks are always open
    confidential: false,
  });
  res.status(201).json(review.toJSON());
}
