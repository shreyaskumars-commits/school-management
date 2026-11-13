import { useState } from "react";

// teacher adds a remark (rating + comment) about one student
export default function RemarkForm({ student, onSubmit, onCancel }) {
  const [rating, setRating] = useState(3);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState({ text: "", isError: false });

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await onSubmit({ studentId: student.id, rating, comment: comment.trim() });
    if (result?.error) {
      setMessage({ text: result.error, isError: true });
    } else {
      setComment("");
      setMessage({ text: "Remark added", isError: false });
    }
  }

  return (
    <section className="card">
      <h2>Add remark for {student.name} (#{student.id})</h2>
      <form className="remark-form" onSubmit={handleSubmit}>
        <label>
          Rating
          <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((r) => (
              <option key={r} value={r}>{r} / 5</option>
            ))}
          </select>
        </label>
        <label className="wide">
          Remark
          <textarea
            rows={3}
            maxLength={500}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            required
          />
        </label>
        <div className="actions">
          <button type="submit" className="btn primary">Save remark</button>
          <button type="button" className="btn" onClick={onCancel}>Close</button>
        </div>
      </form>
      <p className={message.isError ? "message error" : "message"} role="status">
        {message.text}
      </p>
    </section>
  );
}
