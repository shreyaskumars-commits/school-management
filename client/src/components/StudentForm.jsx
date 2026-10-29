import { useState } from "react";

const EMPTY = { name: "", department: "", year: 1 };

// `student` set -> edit mode; the parent remounts this form (via key) per student
export default function StudentForm({ student, message, onSubmit, onCancel }) {
  const [values, setValues] = useState(student ?? EMPTY);
  const editing = Boolean(student);

  function handleChange(e) {
    const { name, value } = e.target;
    setValues({ ...values, [name]: name === "year" ? Number(value) : value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const { name, department, year } = values;
    const ok = await onSubmit({ name, department, year });
    if (ok) setValues(EMPTY);
  }

  return (
    <section className="card">
      <h2>{editing ? `Edit student #${student.id}` : "Add student"}</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Name
          <input name="name" value={values.name} onChange={handleChange} required />
        </label>
        <label>
          Department
          <input
            name="department"
            value={values.department}
            onChange={handleChange}
            required
          />
        </label>
        <label>
          Year
          <select name="year" value={values.year} onChange={handleChange}>
            {[1, 2, 3, 4].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
        <div className="actions">
          <button type="submit" className="btn primary">
            {editing ? "Save changes" : "Add student"}
          </button>
          {editing && (
            <button type="button" className="btn" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      </form>
      <p className={message?.isError ? "message error" : "message"} role="status">
        {message?.text}
      </p>
    </section>
  );
}
