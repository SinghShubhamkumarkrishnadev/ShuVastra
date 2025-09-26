import dotenv from "dotenv";
import http from "http";
import mongoose from "mongoose"; 
import app from "./app.js";
import connectDB from "./config/db.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    const server = http.createServer(app);

    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });

    // Graceful shutdown (on Ctrl+C or kill)
    process.on("SIGINT", () => {
      console.log("🛑 Server shutting down...");
      mongoose.connection.close(() => {
        console.log("📦 MongoDB connection closed.");
        process.exit(0);
      });
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  }
};

startServer();
