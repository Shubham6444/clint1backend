const express = require("express")
const cors = require("cors")
const fs = require("fs").promises
const path = require("path")
require("dotenv").config()
const morgan = require("morgan")

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors())
app.use(morgan("dev"))  // Log format: :method :url :status :response-time ms

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, "public")));

// Database files (JSON for demo - replace with real database)
const DB_PATH = path.join(__dirname, "database")
const USERS_FILE = path.join(DB_PATH, "users.json")
const PLANS_FILE = path.join(DB_PATH, "plans.json")
const REVIEWS_FILE = path.join(DB_PATH, "reviews.json")
const CHANNELS_FILE = path.join(DB_PATH, "channels.json")
const DEALS_FILE = path.join(DB_PATH, "deals.json")

// Initialize database files
async function initializeDatabase() {
  try {
    await fs.mkdir(DB_PATH, { recursive: true })

    // Initialize users.json
    try {
      await fs.access(USERS_FILE)
    } catch {
      await fs.writeFile(USERS_FILE, JSON.stringify([]))
    }

    // Initialize plans.json with deal-based plans
    try {
      await fs.access(PLANS_FILE)
    } catch {
      const defaultPlans = [
        {
          id: 1,
          name: "10K Subscribers Deal",
          price: 99.99,
          description: "Get 10,000 real YouTube subscribers",
          features: [
            "10,000 real subscribers",
            "Organic growth strategy",
            "30-day delivery",
            "Money-back guarantee",
            "24/7 support",
          ],
          popular: false,
          active: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 2,
          name: "100K Subscribers Deal",
          price: 499.99,
          description: "Reach 100,000 YouTube subscribers fast",
          features: [
            "100,000 real subscribers",
            "Advanced growth tactics",
            "60-day delivery",
            "Channel optimization",
            "Priority support",
            "Analytics tracking",
          ],
          popular: true,
          active: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 3,
          name: "1M Subscribers Deal",
          price: 1999.99,
          description: "Ultimate growth package for 1 million subscribers",
          features: [
            "1,000,000 real subscribers",
            "Complete channel makeover",
            "90-day delivery",
            "Personal growth manager",
            "Custom content strategy",
            "Monetization guidance",
            "Brand partnership opportunities",
          ],
          popular: false,
          active: true,
          createdAt: new Date().toISOString(),
        },
      ]
      await fs.writeFile(PLANS_FILE, JSON.stringify(defaultPlans, null, 2))
    }

    // Initialize other files
    const files = [
      { file: REVIEWS_FILE, data: [] },
      { file: CHANNELS_FILE, data: [] },
      { file: DEALS_FILE, data: [] },
    ]

    for (const { file, data } of files) {
      try {
        await fs.access(file)
      } catch {
        await fs.writeFile(file, JSON.stringify(data, null, 2))
      }
    }

    console.log("✅ Database initialized successfully")
  } catch (error) {
    console.error("❌ Database initialization error:", error)
  }
}

// Import routes
const authRoutes = require("./routes/auth")
const homeRoutes = require("./routes/home")
const planRoutes = require("./routes/plans")
const reviewRoutes = require("./routes/reviews")
const dealsRoutes = require("./routes/deals")
const dashboardRoutes = require("./routes/dashboard")
const adminRoutes = require("./routes/admin")
const infoRoutes = require("./routes/info")
const channelRoutes = require("./routes/channels")
const backupRoute = require("./routes/backup")
const editor = require("./routes/editor")
const cookieParser = require("cookie-parser");

app.use(cookieParser(process.env.JWT_SECRET)); // secret key is optional (for signed cookies)

// Use routes
app.use("/api/auth", authRoutes)
app.use("/api/home", homeRoutes)
app.use("/api/plans", planRoutes)
app.use("/api/reviews", reviewRoutes)
app.use("/api/channels", channelRoutes)
app.use("/api/deals", dealsRoutes)
app.use("/api/dashboard", dashboardRoutes)
app.use("/api/admin", adminRoutes)
app.use("/api", infoRoutes)
app.use("/api", backupRoute)
app.use("/editor", editor)

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "CreatorHub Deal System API is running",
    timestamp: new Date().toISOString(),
  })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: "Something went wrong!" })
})

// 404 handler
// app.use("*", (req, res) => {
//   res.status(404).json({ error: "Route not found" })
// })

// Start server
async function startServer() {
  await initializeDatabase()
  app.listen(PORT, () => {
    console.log(`🚀 CreatorHub Deal System running on port ${PORT}`)
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`)
    console.log(`💼 Admin login: admin@creatorhub.com`)
  })
}

startServer()

module.exports = app
