const express = require("express")
const fs = require("fs").promises
const path = require("path")
const jwt = require("jsonwebtoken")

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"
const PAYMENTS_FILE = path.join(__dirname, "../database/payments.json")
const USERS_FILE = path.join(__dirname, "../database/users.json")
const PLANS_FILE = path.join(__dirname, "../database/plans.json")

// Helper functions
async function readPayments() {
  try {
    const data = await fs.readFile(PAYMENTS_FILE, "utf8")
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

async function writePayments(payments) {
  try {
    await fs.writeFile(PAYMENTS_FILE, JSON.stringify(payments, null, 2))
    return true
  } catch (error) {
    console.error("Error writing payments:", error)
    return false
  }
}

async function readUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, "utf8")
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

async function writeUsers(users) {
  try {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2))
    return true
  } catch (error) {
    console.error("Error writing users:", error)
    return false
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
    return res.status(401).json({
      error: "Please login to make a payment",
      redirectTo: "/login",
    })
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        error: "Please login to make a payment",
        redirectTo: "/login",
      })
    }
    req.user = user
    next()
  })
}

// Create payment intent
router.post("/create-payment", authenticateToken, async (req, res) => {
  try {
    const { planId, customPlan, youtubeInfo } = req.body

    let plan
    let amount

    if (customPlan) {
      // Handle custom plan
      plan = customPlan
      amount = customPlan.price
    } else {
      // Handle regular plan
      const plans = await readPlans()
      plan = plans.find((p) => p.id === Number.parseInt(planId))

      if (!plan) {
        return res.status(404).json({ error: "Plan not found" })
      }

      amount = plan.price
    }

    const users = await readUsers()
    const user = users.find((u) => u.id === req.user.id)

    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    // Create payment record
    const payments = await readPayments()
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const payment = {
      id: paymentId,
      userId: user.id,
      planId: customPlan ? "custom" : planId,
      planName: plan.name,
      planType: plan.planType || "recurring",
      amount: amount,
      currency: "USD",
      status: "pending",
      paymentMethod: null,
      youtubeInfo: youtubeInfo || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    payments.push(payment)
    await writePayments(payments)

    // In a real app, you would integrate with Stripe, PayPal, etc.
    // For demo, we'll simulate payment processing
    res.json({
      message: "Payment created successfully",
      paymentId: paymentId,
      amount: amount,
      currency: "USD",
      // In real app, return Stripe client_secret or PayPal order ID
      clientSecret: `pi_${paymentId}_secret_demo`,
    })
  } catch (error) {
    console.error("Create payment error:", error)
    res.status(500).json({ error: "Failed to create payment" })
  }
})

// Confirm payment (simulate payment success)
router.post("/confirm-payment", authenticateToken, async (req, res) => {
  try {
    const { paymentId, paymentMethodId } = req.body

    if (!paymentId) {
      return res.status(400).json({ error: "Payment ID is required" })
    }

    const payments = await readPayments()
    const payment = payments.find((p) => p.id === paymentId)

    if (!payment) {
      return res.status(404).json({ error: "Payment not found" })
    }

    if (payment.userId !== req.user.id) {
      return res.status(403).json({ error: "Unauthorized" })
    }

    // Update payment status
    payment.status = "completed"
    payment.paymentMethod = paymentMethodId || "demo_card"
    payment.completedAt = new Date().toISOString()
    payment.updatedAt = new Date().toISOString()

    await writePayments(payments)

    // Update user's current plan and create mission if one-time plan
    const users = await readUsers()
    const user = users.find((u) => u.id === req.user.id)

    if (user) {
      if (payment.planType === "one-time") {
        // Create mission for one-time plans
        const mission = {
          id: `mission_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: `Reach ${payment.youtubeInfo?.targetSubscribers || "Target"} Subscribers`,
          description: `Grow your channel "${payment.youtubeInfo?.channelName || "Your Channel"}" to ${payment.youtubeInfo?.targetSubscribers || "target"} subscribers`,
          type: "subscribers",
          targetValue: payment.youtubeInfo?.targetSubscribers || "100000",
          initialValue: payment.youtubeInfo?.currentSubscribers || "0",
          planId: payment.planId,
          planName: payment.planName,
          completed: false,
          progress: 0,
          createdAt: new Date().toISOString(),
        }

        if (!user.missions) {
          user.missions = []
        }
        user.missions.push(mission)
      } else {
        // Regular recurring plan
        user.currentPlan = {
          planId: payment.planId,
          planName: payment.planName,
          planType: payment.planType,
          amount: payment.amount,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
          status: "active",
        }
      }

      await writeUsers(users)
    }

    res.json({
      message: "Payment confirmed successfully",
      payment: payment,
      plan: user.currentPlan,
    })
  } catch (error) {
    console.error("Confirm payment error:", error)
    res.status(500).json({ error: "Failed to confirm payment" })
  }
})

// Get user's payment history
router.get("/history", authenticateToken, async (req, res) => {
  try {
    const payments = await readPayments()
    const userPayments = payments.filter((p) => p.userId === req.user.id)

    res.json(userPayments)
  } catch (error) {
    console.error("Get payment history error:", error)
    res.status(500).json({ error: "Failed to fetch payment history" })
  }
})

module.exports = router
