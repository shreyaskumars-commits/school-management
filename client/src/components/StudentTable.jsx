// onRemark set -> each row gets an "Add remark" button; remarkDisabled greys it out
export default function StudentTable({
  students, onEdit, onDelete, onRemark, remarkDisabled, remarkHint,
}) {
  return (
    <table>
      <thead>
        <tr>
          <th>ID</th><th>Name</th><th>Department</th><th>Year</th><th></th>
        </tr>
      </thead>
      <tbody>
        {students.length === 0 ? (
          <tr>
            <td colSpan={5} className="empty">No students found</td>
          </tr>
        ) : (
          students.map((s) => (
            <tr key={s.id}>
              <td>{s.id}</td>
              <td>{s.name}</td>
              <td>{s.department}</td>
              <td>Year {s.year}</td>
              <td>
                <button className="btn small" onClick={() => onEdit(s)}>
                  Edit
                </button>{" "}
                {onRemark && (
                  <>
                    <button
                      className="btn small"
                      disabled={remarkDisabled}
                      title={remarkDisabled ? remarkHint : undefined}
                      onClick={() => onRemark(s)}
                    >
                      Add remark
                    </button>{" "}
                  </>
                )}
                {onDelete && (
                  <button className="btn small danger" onClick={() => onDelete(s)}>
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
