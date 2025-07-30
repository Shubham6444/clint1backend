const express = require("express")
const fs = require("fs").promises
const path = require("path")
const jwt = require("jsonwebtoken")
const { table } = require("console")

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"
const USERS_FILE = path.join(__dirname, "../database/users.json")
const DEALS_FILE = path.join(__dirname, "../database/deals.json")
const PLANS_FILE = path.join(__dirname, "../database/plans.json")
const REVIEWS_FILE = path.join(__dirname, "../database/reviews.json")
const CHANNELS_FILE = path.join(__dirname, "../database/channels.json")
const PAYMENTS_FILE = path.join(__dirname, "../database/payments.json")

// Helper functions
async function readFile(filePath) {
  try {
    const data = await fs.readFile(filePath, "utf8")
    return JSON.parse(data)
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error)
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
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]
console.log(token)
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

// Get admin dashboard data - NO AUTH REQUIRED
router.get("/dashboard",authenticateToken, async (req, res) => {
  try {
    console.log("Admin dashboard route called - NO AUTHENTICATION REQUIRED")

    // Remove any authentication checks completely
    const [users, deals, plans, reviews, channels, payments] = await Promise.all([
      readFile(USERS_FILE),
      readFile(DEALS_FILE),
      readFile(PLANS_FILE),
      readFile(REVIEWS_FILE),
      readFile(CHANNELS_FILE),
      readFile(PAYMENTS_FILE),
    ])

    // Rest of the function remains the same...
    const totalUsers = users.length
    const totalDeals = deals.length
    const pendingDeals = deals.filter((d) => d.status === "pending").length
    const completedDeals = deals.filter((d) => d.status === "completed").length
    const totalRevenue = deals
      .filter((d) => d.status === "completed")
      .reduce((sum, deal) => sum + (deal.planPrice || 0), 0)
    const totalPlans = plans.length
    const totalReviews = reviews.length
    const totalChannels = channels.length

    const recentDeals = deals
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10)
      .map((deal) => {
        const user = users.find((u) => u.id === deal.userId)
        return {
          ...deal,
          user: user
            ? {
                fullName: user.fullName,
                email: user.email,
                whatsappNumber: user.whatsappNumber,
              }
            : null,
        }
      })

    const recentUsers = users
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10)
      .map((user) => ({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        whatsappNumber: user.whatsappNumber,
        isAdmin: user.isAdmin,
        
        createdAt: user.createdAt,
        currentPlan: user.currentPlan || null,
      }))

    const pendingReviews = reviews.filter((r) => !r.approved)

    const dashboardData = {
      stats: {
        totalUsers,
        totalDeals,
        pendingDeals,
        completedDeals,
        totalRevenue,
        pendingReviews: pendingReviews.length,
        totalPlans,
        totalReviews,
        totalChannels,
      },
      recentDeals,
      recentUsers,
      pendingReviews: pendingReviews.slice(0, 5),
      allDeals: deals.map((deal) => {
        const user = users.find((u) => u.id === deal.userId)
        return {
          ...deal,
          user: user
            ? {
                fullName: user.fullName,
                email: user.email,
                whatsappNumber: user.whatsappNumber,
              }
            : null,
        }
      }),
      allUsers: users.map((user) => ({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        whatsappNumber: user.whatsappNumber,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt,
        currentPlan: user.currentPlan || null,
      })),
      allReviews: reviews,
      allPlans: plans,
      allChannels: channels,
    }

    console.log("Sending dashboard data successfully without authentication")
    res.json(dashboardData)
  } catch (error) {
    console.error("Admin dashboard error:", error)
    res.status(500).json({ error: "Failed to fetch admin dashboard data" })
  }
})

// Get user purchases for admin - NO AUTH REQUIRED
router.get("/purchases", async (req, res) => {
  try {
    const [payments, users, plans, deals] = await Promise.all([
      readFile(PAYMENTS_FILE),
      readFile(USERS_FILE),
      readFile(PLANS_FILE),
      readFile(DEALS_FILE),
    ])

    const purchasesWithUserInfo = []

    payments.forEach((payment) => {
      const user = users.find((u) => u.id === payment.userId)
      const plan = plans.find((p) => p.id === payment.planId)

      purchasesWithUserInfo.push({
        id: payment.id,
        type: "payment",
        userName: user?.fullName || "Unknown User",
        userEmail: user?.email || "Unknown",
        planName: payment.planName || plan?.name || "Unknown Plan",
        planType: payment.planType || plan?.planType || "recurring",
        amount: payment.amount || 0,
        status: payment.status || "pending",
        createdAt: payment.createdAt,
      })
    })

    deals.forEach((deal) => {
      const user = users.find((u) => u.id === deal.userId)

      purchasesWithUserInfo.push({
        id: `deal_${deal.id}`,
        type: "deal",
        userName: user?.fullName || "Unknown User",
        userEmail: user?.email || "Unknown",
        planName: deal.planName || "Unknown Plan",
        planType: deal.planType || "recurring",
        amount: deal.planPrice || 0,
        status: deal.status || "pending",
        createdAt: deal.createdAt,
        channelInfo: deal.channelInfo,
      })
    })

    purchasesWithUserInfo.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    res.json(purchasesWithUserInfo)
  } catch (error) {
    console.error("Get user purchases error:", error)
    res.status(500).json({ error: "Failed to fetch user purchases" })
  }
})

// Get all deals for admin
router.get("/deals", async (req, res) => {
  try {
    const deals = await readFile(DEALS_FILE)
    const users = await readFile(USERS_FILE)

    console.log(`Found ${deals.length} deals and ${users.length} users`)

    // Add user info to deals
    const dealsWithUsers = deals.map((deal) => {
      const user = users.find((u) => u.id === deal.userId)
      return {
        ...deal,
        user: user
          ? {
              fullName: user.fullName,
              email: user.email,
              whatsappNumber: user.whatsappNumber,
            }
          : null,
      }
    })

    // Sort by creation date (most recent first)
    dealsWithUsers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    res.json({
      deals: dealsWithUsers,
      total: dealsWithUsers.length,
    })
  } catch (error) {
    console.error("Get admin deals error:", error)
    res.status(500).json({ error: "Failed to fetch deals" })
  }
})



// Update deal status
router.put("/deals/:dealId/status", async (req, res) => {
  try {
    const dealId = Number.parseInt(req.params.dealId)
    const { status, adminNotes } = req.body

    console.log(`Updating deal ${dealId} to status: ${status}`)

    if (!["pending", "in_progress", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" })
    }

    const deals = await readFile(DEALS_FILE)
    const dealIndex = deals.findIndex((d) => d.id === dealId)

    if (dealIndex === -1) {
      return res.status(404).json({ error: "Deal not found" })
    }

    deals[dealIndex].status = status
    deals[dealIndex].adminNotes = adminNotes || deals[dealIndex].adminNotes || ""
    deals[dealIndex].updatedAt = new Date().toISOString()

    if (status === "completed") {
      deals[dealIndex].completedAt = new Date().toISOString()
      deals[dealIndex].paymentStatus = "paid"
    }

    const success = await writeFile(DEALS_FILE, deals)

    if (!success) {
      return res.status(500).json({ error: "Failed to save deal update" })
    }

    console.log(`Deal ${dealId} updated successfully`)

    res.json({
      message: "Deal status updated successfully",
      deal: deals[dealIndex],
    })
  } catch (error) {
    console.error("Update deal status error:", error)
    res.status(500).json({ error: "Failed to update deal status" })
  }
})

// Delete deal
router.delete("/deals/:dealId", async (req, res) => {
  try {
    const dealId = Number.parseInt(req.params.dealId)
    const deals = await readFile(DEALS_FILE)

    const dealIndex = deals.findIndex((d) => d.id === dealId)
    if (dealIndex === -1) {
      return res.status(404).json({ error: "Deal not found" })
    }

    deals.splice(dealIndex, 1)
    await writeFile(DEALS_FILE, deals)

    res.json({ message: "Deal deleted successfully" })
  } catch (error) {
    console.error("Delete deal error:", error)
    res.status(500).json({ error: "Failed to delete deal" })
  }
})

// Plans management
router.get("/plans", async (req, res) => {
  try {
    const plans = await readFile(PLANS_FILE)
    res.json({ plans })
  } catch (error) {
    console.error("Get admin plans error:", error)
    res.status(500).json({ error: "Failed to fetch plans" })
  }
})

router.post("/plans", async (req, res) => {
  try {
    const { name, description, price, features, popular, planType, period } = req.body

    if (!name || !description || price === undefined) {
      return res.status(400).json({ error: "Name, description, and price are required" })
    }

    const plans = await readFile(PLANS_FILE)
    const newPlan = {
      id: Math.max(...plans.map((p) => p.id), 0) + 1,
      name,
      description,
      price: Number.parseFloat(price),
      period: period || "/month",
      planType: planType || "recurring",
      features: Array.isArray(features) ? features : features ? features.split("\n").filter((f) => f.trim()) : [],
      popular: popular === true,
      active: true,
      createdAt: new Date().toISOString(),
    }

    plans.push(newPlan)
    await writeFile(PLANS_FILE, plans)

    res.status(201).json({
      message: "Plan created successfully",
      plan: newPlan,
    })
  } catch (error) {
    console.error("Create plan error:", error)
    res.status(500).json({ error: "Failed to create plan" })
  }
})

router.put("/plans/:planId", async (req, res) => {
  try {
    const planId = Number.parseInt(req.params.planId)
    const updateData = req.body

    const plans = await readFile(PLANS_FILE)
    const planIndex = plans.findIndex((p) => p.id === planId)

    if (planIndex === -1) {
      return res.status(404).json({ error: "Plan not found" })
    }

    plans[planIndex] = {
      ...plans[planIndex],
      ...updateData,
      updatedAt: new Date().toISOString(),
    }
    await writeFile(PLANS_FILE, plans)

    res.json({
      message: "Plan updated successfully",
      plan: plans[planIndex],
    })
  } catch (error) {
    console.error("Update plan error:", error)
    res.status(500).json({ error: "Failed to update plan" })
  }
})

router.delete("/plans/:planId", async (req, res) => {
  try {
    const planId = Number.parseInt(req.params.planId)
    const plans = await readFile(PLANS_FILE)

    const planIndex = plans.findIndex((p) => p.id === planId)
    if (planIndex === -1) {
      return res.status(404).json({ error: "Plan not found" })
    }

    plans.splice(planIndex, 1)
    await writeFile(PLANS_FILE, plans)

    res.json({ message: "Plan deleted successfully" })
  } catch (error) {
    console.error("Delete plan error:", error)
    res.status(500).json({ error: "Failed to delete plan" })
  }
})

// Reviews management
router.get("/reviews", async (req, res) => {
  try {
    const reviews = await readFile(REVIEWS_FILE)
    res.json({
      reviews: reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    })
  } catch (error) {
    console.error("Get admin reviews error:", error)
    res.status(500).json({ error: "Failed to fetch reviews" })
  }
})

router.post("/reviews", async (req, res) => {
  try {
    const { name, rating, comment, subscribers, verified } = req.body

    if (!name || !rating || !comment) {
      return res.status(400).json({ error: "Name, rating, and comment are required" })
    }

    const reviews = await readFile(REVIEWS_FILE)
    const newReview = {
      id: Math.max(...reviews.map((r) => r.id), 0) + 1,
      name,
      rating: Number.parseInt(rating),
      comment,
      subscribers: subscribers || "10K",
      verified: verified === true,
      approved: true, // Auto-approve admin-created reviews
      isFake: true, // Mark as admin-created
      likes: Math.floor(Math.random() * 20) + 5,
      createdAt: new Date().toISOString(),
    }

    reviews.push(newReview)
    await writeFile(REVIEWS_FILE, reviews)

    res.status(201).json({
      message: "Review created successfully",
      review: newReview,
    })
  } catch (error) {
    console.error("Create fake review error:", error)
    res.status(500).json({ error: "Failed to create review" })
  }
})

router.put("/reviews/:reviewId/approve", async (req, res) => {
  try {
    const reviewId = Number.parseInt(req.params.reviewId)
    const reviews = await readFile(REVIEWS_FILE)
    const reviewIndex = reviews.findIndex((r) => r.id === reviewId)

    if (reviewIndex === -1) {
      return res.status(404).json({ error: "Review not found" })
    }

    reviews[reviewIndex].approved = true
    await writeFile(REVIEWS_FILE, reviews)

    res.json({
      message: "Review approved successfully",
      review: reviews[reviewIndex],
    })
  } catch (error) {
    console.error("Approve review error:", error)
    res.status(500).json({ error: "Failed to approve review" })
  }
})

router.delete("/reviews/:reviewId", async (req, res) => {
  try {
    const reviewId = Number.parseInt(req.params.reviewId)
    const reviews = await readFile(REVIEWS_FILE)

    const reviewIndex = reviews.findIndex((r) => r.id === reviewId)
    if (reviewIndex === -1) {
      return res.status(404).json({ error: "Review not found" })
    }

    reviews.splice(reviewIndex, 1)
    await writeFile(REVIEWS_FILE, reviews)

    res.json({ message: "Review deleted successfully" })
  } catch (error) {
    console.error("Delete review error:", error)
    res.status(500).json({ error: "Failed to delete review" })
  }
})

// Users management
router.get("/users", async (req, res) => {
  try {
    const users = await readFile(USERS_FILE)
    const usersWithoutPasswords = users.map((user) => {
      const { password, ...userWithoutPassword } = user
      return userWithoutPassword
    })

    res.json({
      users: usersWithoutPasswords.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    })
  } catch (error) {
    console.error("Get users error:", error)
    res.status(500).json({ error: "Failed to fetch users" })
  }
})

router.put("/users/:userId", async (req, res) => {
  try {
    const userId = Number.parseInt(req.params.userId)
    const updateData = req.body

    const users = await readFile(USERS_FILE)
    const userIndex = users.findIndex((u) => u.id === userId)

    if (userIndex === -1) {
      return res.status(404).json({ error: "User not found" })
    }

    // Don't allow updating password through this endpoint
    delete updateData.password

    users[userIndex] = {
      ...users[userIndex],
      ...updateData,
      updatedAt: new Date().toISOString(),
    }
    await writeFile(USERS_FILE, users)

    const { password, ...userResponse } = users[userIndex]

    res.json({
      message: "User updated successfully",
      user: userResponse,
    })
  } catch (error) {
    console.error("Update user error:", error)
    res.status(500).json({ error: "Failed to update user" })
  }
})

router.delete("/users/:userId", async (req, res) => {
  try {
    const userId = Number.parseInt(req.params.userId)
    const users = await readFile(USERS_FILE)

    const userIndex = users.findIndex((u) => u.id === userId)
    if (userIndex === -1) {
      return res.status(404).json({ error: "User not found" })
    }

    // Don't allow deleting admin users
    if (users[userIndex].isAdmin) {
      return res.status(400).json({ error: "Cannot delete admin users" })
    }

    users.splice(userIndex, 1)
    await writeFile(USERS_FILE, users)

    res.json({ message: "User deleted successfully" })
  } catch (error) {
    console.error("Delete user error:", error)
    res.status(500).json({ error: "Failed to delete user" })
  }
})

module.exports = router
