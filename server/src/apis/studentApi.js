import { Router } from "express";
import * as controller from "../controllers/studentController.js";
import { requireLogin, requireRole } from "../middlewares/auth.js";
import { validateStudent } from "../middlewares/validateStudent.js";
import { loadStudent } from "../middlewares/loadStudent.js";

const router = Router();

// every /students route needs a login
router.use(requireLogin);

router.get("/", controller.list);
router.get("/:id", loadStudent, controller.get);
router.post("/", validateStudent, controller.create);
router.patch("/:id", loadStudent, controller.update);
// only the principal may delete
router.delete("/:id", requireRole("principal"), loadStudent, controller.remove);

export default router;
