import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// demo accounts only: real apps keep users in a database
const SALT = "college-demo-salt";
const hash = (password) => scryptSync(password, SALT, 32);

const users = [
  { userId: "principal", role: "principal", passwordHash: hash("principal123") },
  { userId: "teacher", role: "teacher", passwordHash: hash("teacher123") },
];

// token -> { userId, role }; lives in memory, so a restart logs everyone out
const sessions = new Map();

// returns { token, userId, role }, or null for a wrong id or password
export function login(userId, password) {
  const user = users.find((u) => u.userId === userId);
  if (!user || !timingSafeEqual(hash(password), user.passwordHash)) {
    return null;
  }
  const token = randomBytes(24).toString("hex");
  sessions.set(token, { userId: user.userId, role: user.role });
  return { token, userId: user.userId, role: user.role };
}

export const logout = (token) => sessions.delete(token);
export const findSession = (token) => sessions.get(token);
