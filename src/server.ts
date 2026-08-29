import express, { Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import http from "http";

dotenv.config();

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 8888;
app.disable("x-powered-by");

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(helmet());
app.use(cors());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP
  message: "Too many requests, please try again later.",
});
app.use(limiter);

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

const server = http.createServer(app).listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

const gracefulShutdown = () => {
  console.log("Starting graceful shutdown...");
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
