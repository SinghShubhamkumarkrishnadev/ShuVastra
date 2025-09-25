import express from "express";
import morgan from "morgan";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import userAuthRoutes from "./routes/userAuth.js";
import adminAuthRoutes from "./routes/adminAuth.js";
import productRoutes from "./routes/productRoutes.js"; // ✅ new

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Basic global limiter (for all routes, in addition to authLimiter on sensitive ones)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { message: "Too many requests, try again later." },
});
app.use(globalLimiter);

// Routes
app.use("/api/auth/user", userAuthRoutes);
app.use("/api/auth/admin", adminAuthRoutes);
app.use("/api/products", productRoutes); 

// Health check route
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date() });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ message: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global error:", err.stack);
  res.status(500).json({ message: "Something went wrong" });
});

export default app;
