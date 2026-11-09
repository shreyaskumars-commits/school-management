import { Student } from "../models/Student.js";
import { checkValues } from "../utils/validators.js";

export async function list(req, res) {
  const { department } = req.query;

  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 10);

  const isCount = (n) => Number.isInteger(n) && n >= 1;

  if (!isCount(page) || !isCount(limit) || limit > 100) {
    return res.status(400).json({
      error: "page and limit must be whole numbers >= 1 and limit <= 100",
    });
  }

  const filter = {};

  if (department) {
    filter.department = {
      $regex: `^${String(department).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      $options: "i",
    };
  }

  const [total, students] = await Promise.all([
    Student.countDocuments(filter),
    Student.find(filter)
      .skip((page - 1) * limit)
      .limit(limit),
  ]);

  res.json({
    page,
    limit,
    total,
    data: students,
  });
}

export function get(req, res) {
  res.json(req.student);
}

export async function create(req, res) {
  const { name, department, year = 1 } = req.body ?? {};

  const problem = checkValues({ name, department, year });

  if (problem) {
    return res.status(422).json({ error: problem });
  }

  const student = await Student.create({
    name,
    department,
    year,
  });

  res.status(201).json(student);
}

export async function update(req, res) {
  const { name, department, year } = req.body ?? {};

  const sent = [name, department, year];

  if (sent.every((v) => v === undefined)) {
    return res.status(400).json({
      error: "send at least one of name, department, year",
    });
  }

  const problem = checkValues({ name, department, year });

  if (problem) {
    return res.status(422).json({ error: problem });
  }

  const updates = {};

  if (name !== undefined) updates.name = name.trim();
  if (department !== undefined) updates.department = department.trim();
  if (year !== undefined) updates.year = year;

  const student = await Student.findOneAndUpdate(
    { id: req.student.id },
    { $set: updates },
    {
      returnDocument: "after",
      runValidators: true,
    }
  );

  if (!student) {
    return res.status(404).json({
      error: "Student not found",
    });
  }

  res.json({
    message: "Student updated",
    notified: req.query.notify === "true",
    student,
  });
}

export async function remove(req, res) {
  await Student.deleteOne({ id: req.student.id });
  res.status(204).end();
}
