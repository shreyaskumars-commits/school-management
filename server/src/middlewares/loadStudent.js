import { Student } from "../models/Student.js";

export async function loadStudent(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "id must be a whole number >= 1" });
  }
  const student = await Student.findOne({ id });
  if (!student) {
    return res.status(404).json({ error: `Student ${id} not found` });
  }
  req.student = student;
  next();
}
