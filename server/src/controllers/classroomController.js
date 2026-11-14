export function notes(req, res) {
  res.json({
    notes: ["Order matters", "next() passes control on"],
  });
}

export function crash() {
  throw new Error("Demo crash");
}
