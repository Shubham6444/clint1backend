const express = require("express")
const fs = require("fs").promises
const path = require("path")

const router = express.Router()
const PLANS_FILE = path.join(__dirname, "../database/plans.json")

// Helper functions
async function readPlans() {
  try {
    const data = await fs.readFile(PLANS_FILE, "utf8")
    return JSON.parse(data)
  } catch (error) {
    return []
  }
} 

async function writePlans(plans) {
  try {
    await fs.writeFile(PLANS_FILE, JSON.stringify(plans, null, 2))
    return true
  } catch (error) {
    console.error("Error writing plans:", error)
    return false
  }
}

// Get all active plans
router.get("/", async (req, res) => {
  try {
    const plans = await readPlans()
    const activePlans = plans.filter((plan) => plan.active)
    res.json(activePlans)
  } catch (error) {
    console.error("Get plans error:", error)
    res.status(500).json({ error: "Failed to fetch plans" })
  }
})

// Get plan by ID
router.get("/:id", async (req, res) => {
  try {
    const plans = await readPlans()
    const plan = plans.find((p) => p.id === Number.parseInt(req.params.id))

    if (!plan) {
      return res.status(404).json({ error: "Plan not found" })
    }

    res.json(plan)
  } catch (error) {
    console.error("Get plan error:", error)
    res.status(500).json({ error: "Failed to fetch plan" })
  }
})

// Create custom plan (for dynamic pricing)
router.post("/custom", async (req, res) => {
  try {
    const { name, features, basePrice, customizations } = req.body

    if (!name || !features || !basePrice) {
      return res.status(400).json({ error: "Name, features, and base price are required" })
    }

    const plans = await readPlans()

    // Calculate custom price based on customizations
    let finalPrice = basePrice
    if (customizations) {
      customizations.forEach((custom) => {
        finalPrice += custom.additionalPrice || 0
      })
    }

    const customPlan = {
      id: Date.now(), // Temporary ID for custom plans
      name: `Custom ${name}`,
      price: finalPrice,
      period: "/month",
      description: "Customized plan based on your needs",
      features: features,
      customizations: customizations || [],
      popular: false,
      active: true,
      isCustom: true,
      createdAt: new Date().toISOString(),
    }

    res.json({
      message: "Custom plan created",
      plan: customPlan,
    })
  } catch (error) {
    console.error("Create custom plan error:", error)
    res.status(500).json({ error: "Failed to create custom plan" })
  }
})

module.exports = router
