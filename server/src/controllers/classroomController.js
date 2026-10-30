export function notes(req, res) {
  res.json({
    notes: ["Order matters", "next() passes control on"],
  });
}

// shows the error handler: throwing here ends up as a 500
export function crash() {
  throw new Error("Demo crash");
}
