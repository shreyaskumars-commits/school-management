import { Router } from "express";
import authApi from "./authApi.js";
import studentApi from "./studentApi.js";
import classroomApi from "./classroomApi.js";
import chatApi from "./chatApi.js";
import adminApi from "./adminApi.js";
import remarkApi from "./remarkApi.js";

const router = Router();

router.get("/", (req, res) => {
  res.json({ message: "Welcome to the College API" });
});
router.use(authApi);
router.use("/students", studentApi);
router.use("/classroom", classroomApi);
router.use("/chat", chatApi);
router.use("/admin", adminApi);
router.use(remarkApi);

export default router;
