// -----------------------------
// IMPORTS
// -----------------------------
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { MongoClient, ObjectId } from "mongodb";

dotenv.config();

// Fix __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -----------------------------
// EXPRESS APP SETUP
// -----------------------------
const app = express();
app.use(cors());
app.use(express.json());

// -----------------------------
// LOGGER MIDDLEWARE
// -----------------------------
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} → ${req.url}`);
  next();
});

// -----------------------------
// STATIC IMAGE MIDDLEWARE
// -----------------------------
app.use("/images", express.static(path.join(__dirname, "images")));


// -----------------------------
// DATABASE CONNECTION
// -----------------------------
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;

if (!MONGO_URI) {
  console.log("❌ ERROR: MONGO_URI missing in .env");
  process.exit(1);
}

const client = new MongoClient(MONGO_URI);
let db;

async function connectDB() {
  try {
    await client.connect();
    db = client.db("extra_class_lesson_db");
    console.log("✅ Connected to MongoDB Atlas");
  } catch (err) {
    console.log("❌ DB Connection Error:", err);
  }
}

await connectDB();

// -----------------------------
// API ROUTES
// -----------------------------

// GET all lessons
app.get("/lessons", async (req, res) => {
  try {
    const lessons = await db.collection("lessons").find({}).toArray();
    res.json(lessons);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch lessons" });
  }
});

// GET lessons search
app.get("/lessons/search", async (req, res) => {
  try {
    const query = (req.query.query || "").toLowerCase();
    if (!query) return res.json(await db.collection("lessons").find({}).toArray());

    const lessons = await db.collection("lessons").find({
      $or: [
        { subject: { $regex: query, $options: "i" } },
        { location: { $regex: query, $options: "i" } },
        { price: { $regex: query } },
        { spaces: { $regex: query } }
      ]
    }).toArray();

    res.json(lessons);
  } catch (err) {
    res.status(500).json({ error: "Search failed" });
  }
});

// POST new order
app.post("/orders", async (req, res) => {
  try {
    const { name, phone, lessonIDs, items } = req.body;

    if (!name || !phone || !lessonIDs || !Array.isArray(lessonIDs) || lessonIDs.length === 0) {
      return res.status(400).json({ error: "Missing or invalid fields" });
    }

    // Validate each item quantity vs spaces
    for (let item of items) {
      const lesson = await db.collection("lessons").findOne({ _id: new ObjectId(item.lessonId) });
      if (!lesson) return res.status(404).json({ error: `Lesson ${item.subject} not found` });
      if (lesson.spaces < item.quantity) return res.status(400).json({ error: `Not enough spaces for "${lesson.subject}"` });
    }

    const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    // Insert order
    const orderResult = await db.collection("orders").insertOne({ name, phone, lessonIDs, items, totalPrice });

    // Decrease spaces for each lesson
    for (let item of items) {
      await db.collection("lessons").updateOne(
        { _id: new ObjectId(item.lessonId) },
        { $inc: { spaces: -item.quantity } }
      );
    }

    res.status(201).json({ message: "Order created", orderId: orderResult.insertedId });
  } catch (err) {
    console.error("Order creation error:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// UPDATE lesson
app.put("/lessons/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const updates = req.body;

    const result = await db.collection("lessons").updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    res.json({ message: "Lesson updated" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update lesson" });
  }
});

// -----------------------------
// START SERVER
// -----------------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
