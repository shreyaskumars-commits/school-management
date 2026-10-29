import { Router } from "express";

const router = Router();

// classroom demo only: real apps need proper authentication
function requireKey(req, res, next) {
  if (req.get("x-classroom-key") !== "learn-node") {
    return res.status(401).json({
      error: "Missing or wrong x-classroom-key header",
    });
  }
  next();
}

router.get("/notes", requireKey, (req, res) => {
  res.json({
    notes: ["Order matters", "next() passes control on"],
  });
});

// shows the error handler: throwing here ends up as a 500
router.get("/crash", () => {
  throw new Error("Demo crash");
});

export default router;
