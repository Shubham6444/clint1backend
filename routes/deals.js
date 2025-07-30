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
async function readFile(filePath) {
  try {
    const data = await fs.readFile(filePath, "utf8")
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

async function writeFile(filePath, data) {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2))
    return true
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error)
    return false
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

// Create new deal
router.post("/create", authenticateToken, async (req, res) => {
  try {
    const { planId, channelName, channelUrl, currentSubscribers, utrNumber, description } = req.body

    // Debug: Log received data
    console.log("Received deal data:", {
      planId,
      channelName,
      channelUrl,
      currentSubscribers,
      utrNumber,
      description,
    })

    // Validation
    if (!planId || !channelName || !channelUrl || !currentSubscribers || !utrNumber) {
      return res.status(400).json({ error: "All fields are required" })
    }

    const plans = await readFile(PLANS_FILE)
    const plan = plans.find((p) => p.id === Number.parseInt(planId))

    if (!plan) {
      return res.status(404).json({ error: "Plan not found" })
    }

    const deals = await readFile(DEALS_FILE)
    const users = await readFile(USERS_FILE)
    const user = users.find((u) => u.id === req.user.id)

    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    // Create new deal
    const newDeal = {
      id: deals.length + 1,
      userId: req.user.id,
      planId: plan.id,
      planName: plan.name,
      planPrice: plan.price,
      planDescription: plan.description,
      channelInfo: {
        channelName: channelName,
        channelUrl: channelUrl,
        currentSubscribers: Number.parseInt(currentSubscribers),
        utrNumber: utrNumber,
        description: description || "",
      },
      status: "pending", // pending, in_progress, completed, cancelled
      paymentStatus: "pending", // pending, paid, failed
      adminNotes: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
    }

    deals.push(newDeal)
    await writeFile(DEALS_FILE, deals)

    res.status(201).json({
      message: "Deal created successfully",
      deal: newDeal,
    })
  } catch (error) {
    console.error("Create deal error:", error)
    res.status(500).json({ error: "Failed to create deal" })
  }
})

// Get user's deals
router.get("/my-deals", authenticateToken, async (req, res) => {
  try {
    const deals = await readFile(DEALS_FILE)
    const userDeals = deals.filter((deal) => deal.userId === req.user.id)

    res.json({
      deals: userDeals.reverse(), // Most recent first
    })
  } catch (error) {
    console.error("Get deals error:", error)
    res.status(500).json({ error: "Failed to fetch deals" })
  }
})

// Get specific deal
router.get("/:dealId", authenticateToken, async (req, res) => {
  try {
    const dealId = Number.parseInt(req.params.dealId)
    const deals = await readFile(DEALS_FILE)
    const deal = deals.find((d) => d.id === dealId && d.userId === req.user.id)

    if (!deal) {
      return res.status(404).json({ error: "Deal not found" })
    }

    res.json({ deal })
  } catch (error) {
    console.error("Get deal error:", error)
    res.status(500).json({ error: "Failed to fetch deal" })
  }
})

module.exports = router
