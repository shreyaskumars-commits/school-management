import { Router } from "express";
import authApi from "./authApi.js";
import studentApi from "./studentApi.js";
import classroomApi from "./classroomApi.js";

const router = Router();

router.get("/", (req, res) => {
  res.json({ message: "Welcome to the College API" });
});
router.use(authApi);
router.use("/students", studentApi);
router.use("/classroom", classroomApi);

export default router;
