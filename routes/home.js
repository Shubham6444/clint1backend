const express = require("express")
const fs = require("fs").promises
const path = require("path")

const router = express.Router()
const PLANS_FILE = path.join(__dirname, "../database/plans.json")
const REVIEWS_FILE = path.join(__dirname, "../database/reviews.json")
const CHANNELS_FILE = path.join(__dirname, "../database/channels.json")

// Helper functions
async function readFile(filePath) {
  try {
    const data = await fs.readFile(filePath, "utf8")
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

// Get home page data
router.get("/", async (req, res) => {
  try {
    const plans = await readFile(PLANS_FILE)
    const reviews = await readFile(REVIEWS_FILE)
    const channels = await readFile(CHANNELS_FILE)

    const activePlans = plans.filter((plan) => plan.active)
    const approvedReviews = reviews.filter((review) => review.approved)
    const promotedChannels = channels.filter((channel) => channel.promoted)

    res.json({
      plans: activePlans,
      reviews: approvedReviews,
      promotedChannels: promotedChannels,
      stats: {
        totalCreators: "50K+",
        totalViews: "2.5B+",
        revenueGenerated: "$125M+",
        averageGrowth: "340%",
      },
    })
  } catch (error) {
    console.error("Home data error:", error)
    res.status(500).json({ error: "Failed to fetch home data" })
  }
})

module.exports = router
