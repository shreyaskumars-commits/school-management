import { Router, raw } from "express";
import * as controller from "../controllers/adminController.js";
import { requireLogin, requireRole } from "../middlewares/auth.js";

const router = Router();

router.use(requireLogin, requireRole("admin"));

router.get("/config", controller.getConfig);
router.put("/config", controller.putConfig);
router.post(
  "/excel",
  raw({ type: "application/octet-stream", limit: "5mb" }),
  controller.uploadExcel
);
router.get("/sample.xlsx", controller.sampleExcel);

export default router;
