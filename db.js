// db.js
const mongoose = require("mongoose")

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://clinte1:5KARtBbMMbW8M8xE@cluster0.kb4ksbg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})

const db = mongoose.connection

db.on("error", console.error.bind(console, "MongoDB connection error:"))
db.once("open", () => {
  console.log("✅ Connected to MongoDB")
})

module.exports = mongoose
