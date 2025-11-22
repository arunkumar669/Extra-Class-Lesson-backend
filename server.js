// -----------------------------
// IMPORTS
// -----------------------------
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { MongoClient, ObjectId } from "mongodb";

dotenv.config();

// -----------------------------
// EXPRESS APP SETUP
// -----------------------------
const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI is missing in .env");
  process.exit(1);
}

// -----------------------------
// MIDDLEWARE
// -----------------------------
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleString()}] ${req.method} → ${req.url}`);
  next();
});

// -----------------------------
// STATIC IMAGES WITH VALIDATION
// -----------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const imagesPath = path.join(__dirname, "images");

app.use("/images", async (req, res) => {
  try {
    const filePath = path.join(imagesPath, req.url);
    const ext = path.extname(filePath).toLowerCase();

    if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
      return res.status(400).json({ error: "Invalid image format" });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Image not found" });
    }

    res.sendFile(filePath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to serve image" });
  }
});

// -----------------------------
// DATABASE CONNECTION
// -----------------------------
const client = new MongoClient(MONGO_URI);
let db;

async function connectDB() {
  try {
    await client.connect();
    db = client.db("extra_class_lesson_db");
    console.log("✅ Connected to MongoDB Atlas");
  } catch (err) {
    console.error("❌ DB Connection Error:", err);
    process.exit(1);
  }
}

await connectDB();

// -----------------------------
// HELPER FUNCTIONS
// -----------------------------
function validateLessonUpdate(data) {
  const allowedFields = ["title", "description", "spaces", "date", "price"];
  const filtered = {};
  for (let key of allowedFields) if (data[key] !== undefined) filtered[key] = data[key];
  return filtered;
}

function validateOrderData(data) {
  const { name, phone, lessonIDs, items } = data;
  return name && phone && Array.isArray(lessonIDs) && Array.isArray(items) && items.length;
}

async function adjustLessonSpaces(lessonIDs, increment = -1, session = null) {
  for (let lessonId of lessonIDs) {
    const result = await db.collection("lessons").findOneAndUpdate(
      { _id: new ObjectId(lessonId), ...(increment < 0 && { spaces: { $gt: 0 } }) },
      { $inc: { spaces: increment } },
      { returnDocument: "after", session }
    );
    if (increment < 0 && !result.value) throw new Error(`Lesson ${lessonId} is fully booked`);
  }
}

// -----------------------------
// ROUTES
// -----------------------------
app.get("/", (req, res) => res.send("✅ Server is running!"));

// GET lessons with search/filter/sort
app.get("/lessons", async (req, res) => {
  try {
    const { title, minSpaces, date, sortBy, order } = req.query;

    const filter = {};
    if (title) filter.title = { $regex: title, $options: "i" };
    if (minSpaces) filter.spaces = { $gte: parseInt(minSpaces) };
    if (date) filter.date = date;

    const sort = {};
    if (sortBy) sort[sortBy] = order === "desc" ? -1 : 1;

    const lessons = await db.collection("lessons").find(filter).sort(sort).toArray();
    res.json(lessons);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch lessons" });
  }
});

// UPDATE lesson
app.put("/lessons/:id", async (req, res) => {
  try {
    const updates = validateLessonUpdate(req.body);
    if (!Object.keys(updates).length) return res.status(400).json({ error: "No valid fields to update" });

    const result = await db.collection("lessons").findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: updates },
      { returnDocument: "after" }
    );

    if (!result.value) return res.status(404).json({ error: "Lesson not found" });
    res.json(result.value);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update lesson" });
  }
});

// GET orders with optional sorting
app.get("/orders", async (req, res) => {
  try {
    const { sortBy, order } = req.query;
    const sort = {};
    if (sortBy) sort[sortBy] = order === "desc" ? -1 : 1;

    const orders = await db.collection("orders").find({}).sort(sort).toArray();
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// CREATE order with transaction
app.post("/orders", async (req, res) => {
  const session = client.startSession();
  try {
    if (!validateOrderData(req.body)) return res.status(400).json({ error: "Invalid order data" });
    const { name, phone, lessonIDs, items } = req.body;
    let orderId;

    await session.withTransaction(async () => {
      await adjustLessonSpaces(lessonIDs, -1, session);
      const result = await db.collection("orders").insertOne({ name, phone, lessonIDs, items, createdAt: new Date() }, { session });
      orderId = result.insertedId;
    });

    res.status(201).json({ message: "Order created", orderId });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || "Failed to create order" });
  } finally {
    await session.endSession();
  }
});

// DELETE order with transaction
app.delete("/orders/:id", async (req, res) => {
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const order = await db.collection("orders").findOne({ _id: new ObjectId(req.params.id) }, { session });
      if (!order) throw new Error("Order not found");

      await adjustLessonSpaces(order.lessonIDs, 1, session);
      await db.collection("orders").deleteOne({ _id: new ObjectId(req.params.id) }, { session });
    });

    res.json({ message: "Order deleted and spaces restored" });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || "Failed to delete order" });
  } finally {
    await session.endSession();
  }
});

// -----------------------------
// START SERVER
// -----------------------------
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
