import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { User } from "../models/User.js";

const SALT = "college-demo-salt";
const hash = (password) => scryptSync(password, SALT, 32).toString("hex");

// demo accounts, created only when the user collection is empty
export async function seedUsers() {
  if ((await User.countDocuments()) === 0) {
    await User.create([
      { Username: "principal", Password: hash("principal123"), role: "principal" },
      { Username: "teacher", Password: hash("teacher123"), role: "teacher" },
    ]);
    console.log("Seeded demo users: principal, teacher");
  }
  // also runs on databases that already have users
  if (!(await User.exists({ Username: "admin" }))) {
    await User.create({ Username: "admin", Password: hash("admin123"), role: "admin" });
    console.log("Seeded demo user: admin");
  }
}

// token -> { userId, role }; lives in memory, so a restart logs everyone out
const sessions = new Map();

// returns { token, userId, role }, or null for a wrong id or password
export async function login(userId, password) {
  const user = await User.findOne({ Username: userId }).lean();
  if (!user) return null;
  const given = Buffer.from(hash(password), "hex");
  const stored = Buffer.from(user.Password, "hex");
  if (given.length !== stored.length || !timingSafeEqual(given, stored)) {
    return null;
  }
  const token = randomBytes(24).toString("hex");
  sessions.set(token, { userId: user.Username, role: user.role, id: String(user._id) });
  return { token, userId: user.Username, role: user.role };
}

export const logout = (token) => sessions.delete(token);
export const findSession = (token) => sessions.get(token);
