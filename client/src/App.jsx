import { useEffect, useState } from "react";
import useStudents from "./hooks/useStudents.js";
import StudentForm from "./components/StudentForm.jsx";
import StudentTable from "./components/StudentTable.jsx";
import Pager from "./components/Pager.jsx";
import ChatWidget from "./components/ChatWidget.jsx";
import RemarkForm from "./components/RemarkForm.jsx";
import { getConfig, addRemark } from "./api.js";

export default function App({ userId, role, canDelete = true, onLogout }) {
  const list = useStudents();
  const [editing, setEditing] = useState(null);
  const [remarkFor, setRemarkFor] = useState(null);
  const [remarksEnabled, setRemarksEnabled] = useState(false);
  const canRemark = role === "teacher";

  // remarks only work when V2 is connected to the school DB; the admin can
  // change that at any time, so look again whenever the tab regains focus
  useEffect(() => {
    if (!canRemark) return;
    const refresh = () =>
      Promise.resolve(getConfig())
        .then((c) => {
          setRemarksEnabled(Boolean(c?.remarksEnabled));
          if (!c?.remarksEnabled) setRemarkFor(null);
        })
        .catch(() => setRemarksEnabled(false));
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [canRemark]);

  async function handleRemark(values) {
    try {
      await addRemark(values);
      return {};
    } catch (err) {
      return { error: err.message };
    }
  }

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
        {onLogout && (
          <span>
            {userId} &nbsp;
            <button className="btn small" onClick={onLogout}>Log out</button>
          </span>
        )}
      </header>

      <main>
        <StudentForm
          key={editing?.id ?? "new"}
          student={editing}
          message={list.message}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />

        {remarkFor && (
          <RemarkForm
            key={remarkFor.id}
            student={remarkFor}
            onSubmit={handleRemark}
            onCancel={() => setRemarkFor(null)}
          />
        )}

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
            onDelete={canDelete ? handleDelete : undefined}
            onRemark={canRemark ? setRemarkFor : undefined}
            remarkDisabled={!remarksEnabled}
            remarkHint="Remarks are only available when the school DB is connected (V2)"
          />
          <Pager
            page={list.page}
            totalPages={list.totalPages}
            onChange={list.setPage}
          />
        </section>
      </main>

      {role && <ChatWidget role={role} />}
    </>
  );
}
