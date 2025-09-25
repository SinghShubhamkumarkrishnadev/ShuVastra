import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";
import connectDB from "../config/db.js";
import Admin from "../models/Admin.js";

// Ensure dotenv loads from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/**
 * Utility: prompt in CLI
 */
const ask = (question) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(question, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
};

const seedAdmin = async () => {
  try {
    await connectDB();

    console.log("🚀 Admin Seeder Started");

    const username = await ask("Enter admin username: ");
    const email = await ask("Enter admin email: ");
    const password = await ask("Enter admin password: ");

    // Check if an admin already exists
    const existing = await Admin.findOne({ role: "admin" });
    if (existing) {
      console.log("⚠️  Admin already exists with email:", existing.email);
      console.log("❌ Only one admin is allowed. Aborting seeding.");
      process.exit(0);
    }

    // Create admin
    const admin = new Admin({
      username,
      email,
      isVerified: true,
    });

    // Set password via virtual (this will trigger pre-save hook)
    admin.password = password;

    await admin.save();

    console.log("✅ Admin seeded successfully!");
    console.log(`Admin Email: ${admin.email}`);
    console.log("⚠️ Make sure to remember the password you entered!");

    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding admin:", err.message);
    process.exit(1);
  }
};

seedAdmin();
