import { Router } from "express";
import * as controller from "../controllers/remarkController.js";
import { requireLogin } from "../middlewares/auth.js";

const router = Router();

router.get("/config", requireLogin, controller.publicConfig);
router.post(
  "/remarks",
  requireLogin,
  (req, res, next) => {
    if (req.user.role === "admin") {
      return res.status(403).json({ error: "The admin cannot add remarks" });
    }
    next();
  },
  controller.addRemark
);

export default router;
