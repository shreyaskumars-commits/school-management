export default function Pager({ page, totalPages, onChange }) {
  return (
    <div className="pager">
      <button className="btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </button>
      <span>Page {page} of {totalPages}</span>
      <button
        className="btn"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
