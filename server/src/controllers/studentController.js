import { store } from "../data/students.js";
import { checkValues } from "../utils/validators.js";

// filter: ?department=  paginate: ?page= and ?limit=
export function list(req, res) {
  const { department } = req.query;
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 10);
  const isCount = (n) => Number.isInteger(n) && n >= 1;
  if (!isCount(page) || !isCount(limit)) {
    return res.status(400).json({
      error: "page and limit must be whole numbers >= 1",
    });
  }
  let result = store.students;
  if (department) {
    const wanted = String(department).toLowerCase();
    result = result.filter(
      (s) => s.department.toLowerCase() === wanted,
    );
  }
  const start = (page - 1) * limit;
  res.json({
    page,
    limit,
    total: result.length,
    data: result.slice(start, start + limit),
  });
}

export function get(req, res) {
  res.json(req.student);
}

export function create(req, res) {
  const { name, department, year = 1 } = req.body;
  const student = {
    id: store.nextId++,
    name: name.trim(),
    department: department.trim(),
    year,
  };
  store.students.push(student);
  res.status(201).json(student);
}

export function update(req, res) {
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
  if (name !== undefined) req.student.name = name.trim();
  if (department !== undefined) {
    req.student.department = department.trim();
  }
  if (year !== undefined) req.student.year = year;
  // notify is a demo flag; nothing is really sent
  res.json({
    message: "Student updated",
    notified: req.query.notify === "true",
    student: req.student,
  });
}

export function remove(req, res) {
  store.students = store.students.filter((s) => s !== req.student);
  res.status(204).end();
}
