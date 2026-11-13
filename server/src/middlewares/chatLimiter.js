import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { CHAT_PER_MINUTE } from "../config/index.js";

export const chatLimiter = rateLimit({   //algo?
  windowMs: 60 * 1000,
  limit: CHAT_PER_MINUTE,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip),
  message: { error: "Too many messages. Please wait a minute." },
});
