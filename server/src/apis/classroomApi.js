import { Router } from "express";
import * as controller from "../controllers/classroomController.js";
import { requireKey } from "../middlewares/classroomKey.js";

const router = Router();

router.get("/notes", requireKey, controller.notes);
router.get("/crash", controller.crash);

export default router;
