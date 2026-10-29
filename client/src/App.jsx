import { useState } from "react";
import useStudents from "./hooks/useStudents.js";
import StudentForm from "./components/StudentForm.jsx";
import StudentTable from "./components/StudentTable.jsx";
import Pager from "./components/Pager.jsx";

export default function App() {
  const list = useStudents();
  const [editing, setEditing] = useState(null);

  async function handleSubmit(values) {
    const ok = editing
      ? await list.update(editing.id, values)
      : await list.add(values);
    if (ok) setEditing(null);
    return ok;
  }

  async function handleDelete(student) {
    if (!confirm(`Delete ${student.name}?`)) return;
    const ok = await list.remove(student);
    if (ok && editing?.id === student.id) setEditing(null);
  }

  function handleEdit(student) {
    list.clearMessage();
    setEditing(student);
  }

  function handleCancel() {
    list.clearMessage();
    setEditing(null);
  }

  return (
    <>
      <header className="topbar">
        <h1>Student Management Portal</h1>
      </header>

      <main>
        <StudentForm
          key={editing?.id ?? "new"}
          student={editing}
          message={list.message}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />

        <section className="card">
          <div className="list-head">
            <h2>Students <span className="count">({list.total})</span></h2>
            <label className="filter">
              Department
              <input
                placeholder="e.g. CSE"
                value={list.department}
                onChange={(e) => list.changeDepartment(e.target.value)}
              />
            </label>
          </div>

          <StudentTable
            students={list.students}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
          <Pager
            page={list.page}
            totalPages={list.totalPages}
            onChange={list.setPage}
          />
        </section>
      </main>
    </>
  );
}
