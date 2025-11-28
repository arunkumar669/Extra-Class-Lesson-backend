import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

const lessons = [
  { subject: "Math", location: "Room 101, Main Building, London", price: 15, spaces: 5, image: "/images/math.jpg" },
  { subject: "English", location: "Library Annex, Kensington", price: 12.5, spaces: 5, image: "/images/english.jpg" },
  { subject: "Physics", location: "Lab A, Westminster", price: 18, spaces: 5, image: "/images/physics.jpg" },
  { subject: "Chemistry", location: "Lab B, Westminster", price: 18, spaces: 5, image: "/images/chemistry.jpg" },
  { subject: "History", location: "Room 205, Culture Street", price: 10, spaces: 5, image: "/images/history.jpg" },
  { subject: "Geography", location: "Room 206, Culture Street", price: 10, spaces: 5, image: "/images/geography.jpg" },
  { subject: "Art", location: "Studio 3, Shoreditch", price: 22, spaces: 5, image: "/images/art.jpg" },
  { subject: "Music", location: "Studio 4, Shoreditch", price: 22, spaces: 5, image: "/images/music.jpg" },
  { subject: "PE", location: "Sports Complex, Greenwich", price: 8, spaces: 5, image: "/images/pe.jpg" },
  { subject: "Programming", location: "Online via Zoom", price: 25, spaces: 5, image: "/images/programming.jpg" }
];

async function seed() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db("extra_class_lesson_db");

    await db.collection("lessons").deleteMany({});
    await db.collection("lessons").insertMany(lessons);

    console.log("✅ Lessons seeded successfully with images");
  } catch (err) {
    console.log("❌ Error seeding lessons:", err);
  } finally {
    await client.close();
  }
}

seed();
