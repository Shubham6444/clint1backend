const express = require("express")
const fs = require("fs").promises
const path = require("path")
const jwt = require("jsonwebtoken")

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"
const USERS_FILE = path.join(__dirname, "../database/users.json")
const DEALS_FILE = path.join(__dirname, "../database/deals.json")
const PLANS_FILE = path.join(__dirname, "../database/plans.json")

// Helper functions
async function readUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, "utf8")
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

async function readDeals() {
  try {
    const data = await fs.readFile(DEALS_FILE, "utf8")
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

async function readPlans() {
  try {
    const data = await fs.readFile(PLANS_FILE, "utf8")
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({ error: "Access token required" })
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" })
    }
    req.user = user
    next()
  })
}

// Get user dashboard data
router.get("/", authenticateToken, async (req, res) => {
  try {
    const users = await readUsers()
    const deals = await readDeals()
    const plans = await readPlans()

    const user = users.find((u) => u.id === req.user.id)
    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    // Get user's deals
    const userDeals = deals.filter((deal) => deal.userId === req.user.id)
    const activeDeals = userDeals.filter((deal) => deal.status === "in_progress" || deal.status === "pending")
    const completedDeals = userDeals.filter((deal) => deal.status === "completed")

    // Calculate stats
    const totalSpent = completedDeals.reduce((sum, deal) => sum + deal.planPrice, 0)
    const activeDealsCount = activeDeals.length
    const completedDealsCount = completedDeals.length

    // Mock analytics data (only show if user has active deals)
    const analytics =
      activeDealsCount > 0
        ? {
            channelViews: Math.floor(Math.random() * 100000) + 50000,
            subscribers: Math.floor(Math.random() * 50000) + 10000,
            videosUploaded: Math.floor(Math.random() * 100) + 20,
            revenue: Math.floor(Math.random() * 5000) + 1000,
          }
        : null

    // Remove password from user response
    const { password: _, ...userResponse } = user

    res.json({
      user: userResponse,
      deals: userDeals.reverse(), // Most recent first
      activeDeals,
      completedDeals,
      availablePlans: plans.filter((p) => p.active),
      analytics,
      stats: {
        totalSpent,
        activeDeals: activeDealsCount,
        completedDeals: completedDealsCount,
        totalDeals: userDeals.length,
      },
    })
  } catch (error) {
    console.error("Dashboard error:", error)
    res.status(500).json({ error: "Failed to fetch dashboard data" })
  }
})

// Update YouTube channel info
router.put("/youtube", authenticateToken, async (req, res) => {
  try {
    const { channelName, channelUrl, currentSubscribers, targetSubscribers, description } = req.body

    const users = await readUsers()
    const userIndex = users.findIndex((u) => u.id === req.user.id)

    if (userIndex === -1) {
      return res.status(404).json({ error: "User not found" })
    }

    // Update user's YouTube info
    users[userIndex].youtubeInfo = {
      channelName,
      channelUrl,
      currentSubscribers,
      targetSubscribers,
      description,
      updatedAt: new Date().toISOString(),
    }
    users[userIndex].updatedAt = new Date().toISOString()

    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2))

    res.json({
      message: "YouTube information updated successfully",
      youtubeInfo: users[userIndex].youtubeInfo,
    })
  } catch (error) {
    console.error("Update YouTube info error:", error)
    res.status(500).json({ error: "Failed to update YouTube information" })
  }
})

module.exports = router
