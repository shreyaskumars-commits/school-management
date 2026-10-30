import express from "express";
import cors from "cors";
import { FRONTEND_ORIGIN } from "./config/index.js";
import { logger } from "./middlewares/logger.js";
import { notFound, errorHandler } from "./middlewares/errorHandlers.js";
import apis from "./apis/index.js";

const app = express();

app.use(logger);
app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json());

// Student Management Portal UI -> http://localhost:3000/portal
app.use("/portal", express.static("public"));

app.use(apis);
app.use(notFound);
app.use(errorHandler);

export default app;
