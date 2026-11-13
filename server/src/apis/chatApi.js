import { Router } from "express";
import * as controller from "../controllers/chatController.js";
import { requireLogin } from "../middlewares/auth.js";
import { chatLimiter } from "../middlewares/chatLimiter.js";

const router = Router();

router.use(requireLogin);

router.get("/history", controller.getHistory);
router.delete("/history", controller.clearHistory);
router.post("/", chatLimiter, controller.sendMessage);

export default router;
