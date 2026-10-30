import { store } from "../data/students.js";

// read :id from the path and find the student
export function loadStudent(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({
      error: "id must be a number",
    });
  }
  const student = store.students.find((s) => s.id === id);
  if (!student) {
    return res.status(404).json({
      error: `Student ${id} not found`,
    });
  }
  req.student = student;
  next();
}
