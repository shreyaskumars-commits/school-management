export function requireKey(req, res, next) {
  if (req.get("x-classroom-key") !== "learn-node") {
    return res.status(401).json({
      error: "Missing or wrong x-classroom-key header",
    });
  }
  next();
}
