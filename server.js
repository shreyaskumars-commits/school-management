import express from "express";
import cors from "cors";
import classroom from "./classroom.js";

const app = express();
const PORT = 3000;
const FRONTEND_ORIGIN = "http://localhost:5173";

let students = [
  { id: 101, name: "Asha", department: "CSE", year: 2 },
  { id: 102, name: "Rahul", department: "IT", year: 3 },
  { id: 103, name: "Meena", department: "CSE", year: 1 },
  { id: 104, name: "Kiran", department: "ECE", year: 4 },
];
let nextId = 105;

// log every request, then pass control on
app.use((req, res, next) => {
  console.log(req.method, req.url);
  next();
});
app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json());

const isText = (v) =>
  typeof v === "string" && v.trim() !== "";
const isYear = (v) =>
  Number.isInteger(v) && v >= 1 && v <= 4;

// returns an error message, or nothing if all is fine
function checkValues({ name, department, year }) {
  if (name !== undefined && !isText(name)) {
    return "name must be text";
  }
  if (department !== undefined && !isText(department)) {
    return "department must be text";
  }
  if (year !== undefined && !isYear(year)) {
    return "year must be a whole number from 1 to 4";
  }
}

// check the body of POST /students
function validateStudent(req, res, next) {
  const { name, department } = req.body ?? {};
  if (name === undefined || department === undefined) {
    return res.status(400).json({
      error: "name and department are required",
    });
  }
  const problem = checkValues(req.body);
  if (problem) {
    return res.status(422).json({ error: problem });
  }
  next();
}

// read :id from the path and find the student
function loadStudent(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({
      error: "id must be a number",
    });
  }
  const student = students.find((s) => s.id === id);
  if (!student) {
    return res.status(404).json({
      error: `Student ${id} not found`,
    });
  }
  req.student = student;
  next();
}

// Student Management Portal UI -> http://localhost:3000/portal
app.use("/portal", express.static("public"));

app.get("/", (req, res) => {
  res.json({ message: "Welcome to the College API" });
});

// filter: ?department=  paginate: ?page= and ?limit=
app.get("/students", (req, res) => {
  const { department } = req.query;
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 10);
  const isCount = (n) => Number.isInteger(n) && n >= 1;
  if (!isCount(page) || !isCount(limit)) {
    return res.status(400).json({
      error: "page and limit must be whole numbers >= 1",
    });
  }
  let result = students;
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
});

app.get("/students/:id", loadStudent, (req, res) => {
  res.json(req.student);
});

app.post("/students", validateStudent, (req, res) => {
  const { name, department, year = 1 } = req.body;
  const student = {
    id: nextId++,
    name: name.trim(),
    department: department.trim(),
    year,
  };
  students.push(student);
  res.status(201).json(student);
});

app.patch("/students/:id", loadStudent, (req, res) => {
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
});

app.delete("/students/:id", loadStudent, (req, res) => {
  students = students.filter((s) => s !== req.student);
  res.status(204).end();
});

app.use("/classroom", classroom);

// no route matched
app.use((req, res) => {
  res.status(404).json({
    error: `Not found: ${req.method} ${req.originalUrl}`,
  });
});

// error handler: four arguments, registered last
app.use((err, req, res, next) => {
  const status = err.status ?? 500;
  if (status === 500) console.error(err);
  res.status(status).json({
    error:
      status === 500 ? "Something went wrong" : err.message,
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
