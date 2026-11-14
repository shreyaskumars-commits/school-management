import { Router } from "express";
import * as controller from "../controllers/chatController.js";
import { requireLogin } from "../middlewares/auth.js";
import { chatLimiter } from "../middlewares/chatLimiter.js";

const router = Router();

router.use(requireLogin, (req, res, next) => {
  if (req.user.role === "admin") {
    return res.status(403).json({ error: "The admin has no chat" });
  }
  next();
});

router.get("/history", controller.getHistory);
router.delete("/history", controller.clearHistory);
router.post("/", chatLimiter, controller.sendMessage);

export default router;
