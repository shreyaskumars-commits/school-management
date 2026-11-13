import { Router } from "express";
import * as controller from "../controllers/adminController.js";
import { requireLogin, requireRole } from "../middlewares/auth.js";

const router = Router();

router.use(requireLogin, requireRole("admin"));

router.get("/config", controller.getConfig);
router.put("/config", controller.putConfig);

export default router;
