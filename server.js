// -----------------------------
// IMPORTS
// -----------------------------
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { MongoClient, ObjectId } from "mongodb";

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

// Logger middleware
app.use((req, res, next) => {
  const now = new Date();
  console.log(`[${now.toLocaleDateString()} ${now.toLocaleTimeString()}] ${req.method} → ${req.url}`);
  next();
});

// -----------------------------
// STATIC IMAGES
// -----------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const imagesPath = path.join(__dirname, "images");

// Serve images safely
app.use("/images", express.static(imagesPath, {
  extensions: ['jpg', 'png'],
  fallthrough: false
}));

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
// TEST ROUTE
// -----------------------------
app.get("/", (req, res) => {
  res.send("✅ Server is running!");
});

// -----------------------------
// GET ALL LESSONS
// -----------------------------
app.get("/lessons", async (req, res) => {
  try {
    const lessons = await db.collection("lessons").find({}).toArray();
    res.json(lessons);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch lessons" });
  }
});

// -----------------------------
// UPDATE LESSON
// -----------------------------
app.put("/lessons/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const updates = req.body;

    const allowedFields = ["title", "description", "spaces", "date", "price"];
    const filteredUpdates = {};
    for (let key of allowedFields) {
      if (updates[key] !== undefined) filteredUpdates[key] = updates[key];
    }

    const result = await db.collection("lessons").findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: filteredUpdates },
      { returnDocument: "after" }
    );

    if (!result.value) return res.status(404).json({ error: "Lesson not found" });

    res.json(result.value);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update lesson" });
  }
});

// -----------------------------
// GET ALL ORDERS
// -----------------------------
app.get("/orders", async (req, res) => {
  try {
    const orders = await db.collection("orders").find({}).toArray();
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// -----------------------------
// CREATE NEW ORDER
// -----------------------------
app.post("/orders", async (req, res) => {
  try {
    const { name, phone, lessonIDs, items } = req.body;

    if (!name || !phone || !lessonIDs || !items || !items.length) {
      return res.status(400).json({ error: "Missing fields" });
    }

    for (let lessonId of lessonIDs) {
      const result = await db.collection("lessons").findOneAndUpdate(
        { _id: new ObjectId(lessonId), spaces: { $gt: 0 } },
        { $inc: { spaces: -1 } },
        { returnDocument: "after" }
      );

      if (!result.value) {
        return res.status(400).json({ error: `Lesson ${lessonId} is fully booked` });
      }
    }

    const orderPayload = {
      name,
      phone,
      lessonIDs,
      items,
      createdAt: new Date()
    };

    const result = await db.collection("orders").insertOne(orderPayload);

    res.status(201).json({
      message: "Order created",
      orderId: result.insertedId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// -----------------------------
// DELETE ORDER
// -----------------------------
app.delete("/orders/:id", async (req, res) => {
  try {
    const orderId = req.params.id;

    // Find the order
    const order = await db.collection("orders").findOne({ _id: new ObjectId(orderId) });
    if (!order) return res.status(404).json({ error: "Order not found" });

    // Restore lesson spaces
    for (let lessonId of order.lessonIDs) {
      await db.collection("lessons").updateOne(
        { _id: new ObjectId(lessonId) },
        { $inc: { spaces: 1 } }
      );
    }

    // Delete the order
    await db.collection("orders").deleteOne({ _id: new ObjectId(orderId) });

    res.json({ message: "Order deleted and spaces restored" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete order" });
  }
});

// -----------------------------
// START SERVER
// -----------------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
