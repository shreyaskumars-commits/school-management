import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { User } from "../models/User.js";

const SALT = "college-demo-salt";
const hash = (password) => scryptSync(password, SALT, 32).toString("hex");

export async function seedUsers() {
  if ((await User.countDocuments()) === 0) {
    await User.create([
      { Username: "principal", Password: hash("principal123"), role: "principal" },
      { Username: "teacher", Password: hash("teacher123"), role: "teacher" },
    ]);
    console.log("Seeded demo users: principal, teacher");
  }
  if (!(await User.exists({ Username: "admin" }))) {
    await User.create({ Username: "admin", Password: hash("admin123"), role: "admin" });
    console.log("Seeded demo user: admin");
  }
}

const sessions = new Map();

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
