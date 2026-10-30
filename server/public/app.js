const API = "/students";
const LIMIT = 5;

const form = document.getElementById("student-form");
const nameInput = document.getElementById("name");
const deptInput = document.getElementById("department");
const yearInput = document.getElementById("year");
const saveBtn = document.getElementById("save-btn");
const cancelBtn = document.getElementById("cancel-btn");
const formTitle = document.getElementById("form-title");
const message = document.getElementById("message");
const rows = document.getElementById("rows");
const count = document.getElementById("count");
const filter = document.getElementById("filter");
const prev = document.getElementById("prev");
const next = document.getElementById("next");
const pageInfo = document.getElementById("page-info");

let page = 1;
let totalPages = 1;
let editingId = null;

function show(text, isError = false) {
  message.textContent = text;
  message.className = isError ? "error" : "";
}

async function request(url, options) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = res.status === 204 ? null : await res.json();
  if (!res.ok) throw new Error(body?.error ?? "Request failed");
  return body;
}

function cell(text) {
  const td = document.createElement("td");
  td.textContent = text;
  return td;
}

function actionButton(label, className, onClick) {
  const b = document.createElement("button");
  b.className = `btn small ${className}`;
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function renderRow(student) {
  const tr = document.createElement("tr");
  tr.append(
    cell(student.id),
    cell(student.name),
    cell(student.department),
    cell(`Year ${student.year}`),
  );
  const actions = document.createElement("td");
  actions.append(
    actionButton("Edit", "", () => startEdit(student)),
    " ",
    actionButton("Delete", "danger", () => remove(student)),
  );
  tr.append(actions);
  return tr;
}

async function load() {
  const params = new URLSearchParams({ page, limit: LIMIT });
  if (filter.value.trim()) params.set("department", filter.value.trim());
  try {
    const { total, data } = await request(`${API}?${params}`);
    totalPages = Math.max(1, Math.ceil(total / LIMIT));
    if (page > totalPages) {
      page = totalPages;
      return load();
    }
    rows.replaceChildren();
    if (data.length === 0) {
      const tr = document.createElement("tr");
      const td = cell("No students found");
      td.colSpan = 5;
      td.className = "empty";
      tr.append(td);
      rows.append(tr);
    } else {
      rows.append(...data.map(renderRow));
    }
    count.textContent = `(${total})`;
    pageInfo.textContent = `Page ${page} of ${totalPages}`;
    prev.disabled = page <= 1;
    next.disabled = page >= totalPages;
  } catch (err) {
    show(err.message, true);
  }
}

function resetForm() {
  editingId = null;
  form.reset();
  formTitle.textContent = "Add student";
  saveBtn.textContent = "Add student";
  cancelBtn.hidden = true;
}

function startEdit(student) {
  editingId = student.id;
  nameInput.value = student.name;
  deptInput.value = student.department;
  yearInput.value = student.year;
  formTitle.textContent = `Edit student #${student.id}`;
  saveBtn.textContent = "Save changes";
  cancelBtn.hidden = false;
  show("");
  nameInput.focus();
}

async function remove(student) {
  if (!confirm(`Delete ${student.name}?`)) return;
  try {
    await request(`${API}/${student.id}`, { method: "DELETE" });
    show(`Deleted ${student.name}`);
    if (editingId === student.id) resetForm();
    load();
  } catch (err) {
    show(err.message, true);
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    name: nameInput.value,
    department: deptInput.value,
    year: Number(yearInput.value),
  };
  try {
    if (editingId === null) {
      await request(API, { method: "POST", body: JSON.stringify(payload) });
      show("Student added");
    } else {
      await request(`${API}/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      show("Student updated");
    }
    resetForm();
    load();
  } catch (err) {
    show(err.message, true);
  }
});

cancelBtn.addEventListener("click", () => {
  resetForm();
  show("");
});

let timer;
filter.addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    page = 1;
    load();
  }, 250);
});

prev.addEventListener("click", () => { page--; load(); });
next.addEventListener("click", () => { page++; load(); });

load();
