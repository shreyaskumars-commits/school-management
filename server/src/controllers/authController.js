import * as authService from "../services/authService.js";
import { bearerToken } from "../middlewares/auth.js";

export async function login(req, res) {
  const { userId, password } = req.body ?? {};
  if (typeof userId !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "userId and password are required" });
  }
  const result = await authService.login(userId, password);
  if (!result) {
    return res.status(401).json({ error: "Wrong user id or password" });
  }
  res.json(result);
}

export function logout(req, res) {
  authService.logout(bearerToken(req));
  res.status(204).end();
}
