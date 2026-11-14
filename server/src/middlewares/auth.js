import { findSession } from "../services/authService.js";

export function bearerToken(req) {
  return (req.get("authorization") ?? "").replace(/^Bearer /, "");
}

export function requireLogin(req, res, next) {
  
  const token = bearerToken(req);
  const user = findSession(token);
  if (!user) {
    return res.status(401).json({ error: "Please log in" });
  }
  req.user = user;
  next();
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: `Only the ${role} can do this` });
    }
    next();
  };
}
