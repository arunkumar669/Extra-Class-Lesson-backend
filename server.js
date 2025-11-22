// -----------------------------
// IMPORTS
// -----------------------------
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

// Load environment variables
dotenv.config();

// -----------------------------
// EXPRESS APP SETUP
// -----------------------------
const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// -----------------------------
// ENV CHECKS
// -----------------------------
if (!MONGO_URI) {
  console.error("❌ MONGO_URI is missing in .env");
  process.exit(1);
}

// -----------------------------
// MIDDLEWARE
// -----------------------------
app.use(cors());
app.use(express.json());

// -----------------------------
// LOGGER MIDDLEWARE
// -----------------------------
app.use((req, res, next) => {
  const now = new Date();
  console.log(`[${now.toLocaleDateString()} ${now.toLocaleTimeString()}] ${req.method} → ${req.url}`);
  next();
});

// -----------------------------
// TEST ROUTE
// -----------------------------
app.get("/", (req, res) => {
  res.send("✅ Server is running!");
});

// -----------------------------
// DATABASE CONNECTION
// -----------------------------
const client = new MongoClient(MONGO_URI);
async function connectDB() {
  try {
    await client.connect();
    console.log("✅ Connected to MongoDB Atlas");
  } catch (err) {
    console.error("❌ DB Connection Error:", err);
    process.exit(1);
  }
}

await connectDB(); // Top-level await works with ES modules

// -----------------------------
// START SERVER
// -----------------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
